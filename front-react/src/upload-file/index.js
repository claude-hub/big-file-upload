import React, { PureComponent } from 'react';
import { Button, Progress, message } from 'antd';
import sparkMD5 from 'spark-md5';
import axios from 'axios';

// 定义上传的每个小块的大小
const CHUNK_SIZE = 10 * 1024 * 1024;
class UploadFile extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      file: null,
      hashProgress: 0, // 计算md5的进度条
      loading: false,
      uploadChunks: [], // 上传后端的块
      url: '' // 上传成功后的url
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
      hashProgress: 0
    });
    try {
    // 分片
      const chunks = this.createFileChunk(file);
      // 每片计算hash
      const hash = await this.calculateHashWorker(chunks);
      // const hash1 = await this.calculateHashIdle(chunks);

      // 文件是否上传过，如果没有，是否有存在的切片。如果文件已经上传，则为秒传成功。
      const { data: { data: { uploaded, uploadedList, url } } } = await axios.post('/api/checkFile', {
        hash,
        // 截取文件后缀名
        ext: file.name.split('.').pop()
      });
      // 文件已经存在后端了
      if (uploaded) {
      // 秒传
        message.success({
          content: '秒传成功'
        });
        this.setState({
          loading: false,
          url: url || ''
        });
        return;
      }
      // 如果上传过 => 需要更新所有已上传的文件信息
      const chunksUpload = chunks.map((chunk, index) => {
      // 切片的名字 hash + index
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

      // 更新上传进度条
      this.setState({
        uploadChunks: chunksUpload
      });

      // 上传文件块
      await this.uploadChunks(chunksUpload, uploadedList);
      // 上传完所有的小块后，发送一个合并文件的请求，后端把合并后的url返回
      await this.mergeRequest(hash);
    } catch (e) {
      message.error('接口错误');
    } finally {
      this.setState({
        loading: false
      });
    }
  }

  /**
   * 大文件分片
   * @param {*} file
   * @param {*} size
   */
  createFileChunk = (file, size = CHUNK_SIZE) => {
    const chunks = [];
    let cur = 0;
    while (cur < file.size) {
      chunks.push({ index: cur, file: file.slice(cur, cur + size) });
      cur += size;
    }
    return chunks;
  }

  /**
   * 文件一旦很大，计算hash就很耗时，采用Web worker不让浏览器卡死
   * 使用 Web worker计算hash
   * @param {Array} chunks
   */
  calculateHashWorker = async (chunks) => new Promise(resolve => {
    this.worker = new Worker('/hash.js');
    this.worker.postMessage({ chunks });
    this.worker.onmessage = e => {
      const { progress, hash } = e.data;
      // 获取到计算进度，实时更新
      const hashProgress = Number(progress.toFixed(2));
      this.setState({
        hashProgress
      });
      // 整个文件hash计算好后，再返回
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

  // 封装上传的 chunk list
  uploadChunks = async (chunks, uploadedList) => {
    const requests = chunks
      // 断点续传, 过滤掉已经上传的chunks
      .filter(chunk => uploadedList.indexOf(chunk.name) === -1)
      .map((chunk) => {
        // 每个chunk的上传都是用formData上传
        const form = new FormData();
        form.append('chunk', chunk.chunk);
        form.append('hash', chunk.hash);
        form.append('name', chunk.name);

        // error:0 为目前上传的错误次数还是0次，用于断点续传
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
    const { data: { data } } = await axios.post('/api/mergeFile', {
      ext: file.name.split('.').pop(),
      size: CHUNK_SIZE,
      hash
    });
    if (data.url) {
      this.setState({
        url: data.url
      });
    }
  }

  /**
   * 上传每个小块
   * @param {*} chunks
   * @param {*} limit
   */
   sendRequest = async (chunks, limit = 2) => new Promise((resolve, reject) => {
     let isStop = false; // 超过重试次数直接终止
     let counter = 0; // 已经上传的数量
     const len = chunks.length;
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
           if (task.error < limit) {
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
     start();
   })

   render() {
     const {
       hashProgress, loading, uploadChunks, file, url
     } = this.state;
     return (
       <div className="content">
         <input type="file" onChange={this.handleChange} />

         <div className="flex">
           <div>计算md5: </div>
           <Progress percent={hashProgress} />
         </div>

         <p>
           <Button
             loading={loading}
             disabled={!file}
             type="primary" size="small" onClick={this.handleClick}>
             Upload
           </Button>
         </p>

         <div className="cube-loading">
           {uploadChunks.map(chunk => (
             <Progress key={chunk.name} percent={chunk.progress} />
           ))}
         </div>

         <div>
           {url && (
           // eslint-disable-next-line jsx-a11y/media-has-caption
             <video width="480" controls>
               <source src={url} type="video/mp4" />
             </video>
           )}
         </div>
       </div>
     );
   }
}

export default UploadFile;