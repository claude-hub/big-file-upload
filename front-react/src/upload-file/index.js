import React, { PureComponent } from 'react';
import { Button, Progress, message } from 'antd';
import sparkMD5 from 'spark-md5';
import axios from 'axios';
import { isImage } from '../utils';

const CHUNK_SIZE = 1 * 1024 * 1024;
class UploadFile extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      file: null,
      progress: 0, // 上传进度条
      hashProgress: 0, // 计算md5的进度条
      loading: false,
      uploadChunks: [] // 上传后端的块
    };
    this.worker = null;
  }

  handleChange = async (e) => {
    const [file] = e.target.files;
    if (!file) return;
    this.setState({
      file
    });
  }

  handleClick = async () => {
    const { file } = this.state;
    if (!file) return;
    this.setState({
      loading: true,
      progress: 0,
      hashProgress: 0
    });

    // 判断图片类型
    // if (!await isImage(file)) {
    //   message.error({
    //     content: '文件不是gif和png格式'
    //   });
    // } else {
    //   message.success({
    //     content: '文件格式正确'
    //   });
    // }

    const chunks = this.createFileChunk(file);
    const hash = await this.calculateHashWorker(chunks);
    const hash1 = await this.calculateHashIdle(chunks);
    // console.log(hash);
    console.log(hash1);
    this.setState({
      loading: false
    });

    // 问一下后端，文件是否上传过，如果没有，是否有存在的切片
    const { data: { data: { uploaded, uploadedList } } } = await axios.post('/api/checkFile', {
      hash,
      ext: file.name.split('.').pop()
    });
    if (uploaded) {
      // 秒传
      message.success({
        content: '秒传成功'
      });
      return;
    }
    // 如果上传过
    const chunksUpload = chunks.map((chunk, index) => {
      // 切片的名字 hash+index
      const name = `${hash}-${index}`;
      return {
        hash,
        name,
        index,
        chunk: chunk.file,
        // 设置进度条，已经上传的，设为100
        progress: uploadedList.indexOf(name) > -1 ? 100 : 0
      };
    });

    this.setState({
      uploadChunks: chunksUpload
    });

    await this.uploadChunks(chunksUpload, uploadedList);

    await this.mergeRequest(hash);

    // const from = new FormData();
    // from.append('name', 'file');
    // from.append('file', file);
    // const res = axios.post('/api/upload', from, {
    //   onUploadProgress: progress => {
    //     const { loaded, total } = progress;
    //     const progress = Number(((loaded / total) * 100).toFixed(2));
    //     this.setState({
    //       progress
    //     });
    //   }
    // });
    // console.log(res);
  }

  createFileChunk = (file, size = CHUNK_SIZE) => {
    const chunks = [];
    let cur = 0;
    while (cur < file.size) {
      chunks.push({ index: cur, file: file.slice(cur, cur + size) });
      cur += size;
    }
    return chunks;
  }

  calculateHashWorker = async (chunks) => new Promise(resolve => {
    this.worker = new Worker('/hash.js');
    this.worker.postMessage({ chunks });
    this.worker.onmessage = e => {
      const { progress, hash } = e.data;
      const hashProgress = Number(progress.toFixed(2));
      this.setState({
        hashProgress
      });
      if (hash) {
        resolve(hash);
      }
    };
  })

  // 60fps
  // 1秒渲染60次 渲染1次 1帧，大概16.6ms
  // |帧(system task，render，script)空闲时间  |帧 painting idle   |帧   |帧   |
  // 借鉴fiber架构
  calculateHashIdle = async (chunks) => new Promise(resolve => {
    const spark = new sparkMD5.ArrayBuffer();
    let count = 0;

    const appendToSpark = async file => new Promise(resolveSpark => {
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = e => {
        spark.append(e.target.result);
        resolveSpark();
      };
    });
    const workLoop = async deadline => {
      // timeRemaining获取当前帧的剩余时间
      while (count < chunks.length && deadline.timeRemaining() > 1) {
        // 空闲时间，且有任务
        // eslint-disable-next-line no-await-in-loop
        await appendToSpark(chunks[count].file);
        count += 1;
        if (count < chunks.length) {
          const hashProgress = Number(
            ((100 * count) / chunks.length).toFixed(2)
          );
          this.setState({
            hashProgress
          });
        } else {
          this.setState({
            hashProgress: 100
          });
          resolve(spark.end());
        }
      }
      // 下次有空闲时间了继续执行workLoop
      window.requestIdleCallback(workLoop);
    };
      // 浏览器一旦空闲，就会调用workLoop
    window.requestIdleCallback(workLoop);
  })

  uploadChunks = async (chunks, uploadedList) => {
    const requests = chunks
      // 断点续传, 过滤掉已经上传的chunks
      .filter(chunk => uploadedList.indexOf(chunk.name) === -1)
      .map((chunk) => {
      // 转成promise
        const form = new FormData();
        form.append('chunk', chunk.chunk);
        form.append('hash', chunk.hash);
        form.append('name', chunk.name);
        return { form, index: chunk.index, error: 0 };
      });
      // .map(({ form, index }) => axios.post('/api/uploadSlice', form, {
      //   onUploadProgress: progress => {
      //     // 不是整体的进度条了，而是每个区块有自己的进度条，整体的进度条需要计算
      //     this.setState(prev => {
      //       const stateChunks = prev.uploadChunks.map((chunk, i) => {
      //         if (i === index) {
      //           chunk.progress = Number(
      //             ((progress.loaded / progress.total) * 100).toFixed(2)
      //           );
      //         }
      //         return chunk;
      //       });
      //       return {
      //         uploadChunks: stateChunks
      //       };
      //     });
      //   }
      // }));
    // await Promise.all(requests);
    // Promise.all一次发生了全部是请求，会阻塞，而且还没有超时重试
    await this.sendRequest(requests);
  }

  mergeRequest = async (hash) => {
    const { file } = this.state;
    await axios.post('/api/mergeFile', {
      ext: file.name.split('.').pop(),
      size: CHUNK_SIZE,
      hash
    });
  }

  async sendRequest(chunks, limit = 2) {
    return new Promise((resolve, reject) => {
      const len = chunks.length;
      let counter = 0;
      let isStop = false;
      const start = async () => {
        if (isStop) {
          return;
        }
        const task = chunks.shift();
        if (task) {
          const { form, index } = task;

          try {
            await axios.post('/api/uploadSlice', form, {
              onUploadProgress: progress => {
                this.setState(prev => {
                  const stateChunks = prev.uploadChunks.map((chunk, i) => {
                    if (i === index) {
                      chunk.progress = Number(
                        ((progress.loaded / progress.total) * 100).toFixed(2)
                      );
                    }
                    return chunk;
                  });
                  return {
                    uploadChunks: stateChunks
                  };
                });
              }
            });
            if (counter === len - 1) {
              // 最后一个任务
              resolve();
            } else {
              counter += 1;
              // 启动下一个任务
              start();
            }
          } catch (e) {
            this.setState(prev => {
              prev.uploadChunks[index].progress = -1;
              return {
                uploadChunks: prev.uploadChunks
              };
            });
            if (task.error < 3) {
              task.error += 1;
              chunks.unshift(task);
              start();
            } else {
              // 错误三次
              isStop = true;
              reject();
            }
          }
        }
      };

      while (limit > 0) {
        // 启动limit个任务
        // 模拟一下延迟
        // setTimeout(() => {
        //   start();
        // }, Math.random() * 2000);
        start();
        limit -= 1;
      }
    });
  }

  render() {
    const {
      progress, hashProgress, loading, uploadChunks
    } = this.state;
    return (
      <div className="content">
        <input type="file" onChange={this.handleChange} />

        <div className="flex">
          <div>上传进度: </div>
          <Progress percent={progress} />
        </div>

        <div className="flex">
          <div>计算md5: </div>
          <Progress percent={hashProgress} />
        </div>

        <p>
          <Button
            loading={loading}
            type="primary" size="small" onClick={this.handleClick}>
            Upload
          </Button>
        </p>

        <div className="cube-loading">
          {uploadChunks.map(chunk => (
            <span
              key={chunk.name} className={
                // eslint-disable-next-line no-nested-ternary
                chunk.progress < 0 ? 'error'
                  : chunk.progress === 100 ? 'success' : 'loading'
              }>
            </span>
          ))}
        </div>
      </div>
    );
  }
}

export default UploadFile;