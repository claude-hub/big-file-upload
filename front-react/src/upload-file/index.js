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
      loading: false
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
        chunk: chunk.file
      };
    });
    await this.uploadChunks(chunksUpload);

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

  uploadChunks = async (chunks) => {
    const requests = chunks.map((chunk, index) => {
      // 转成promise
      const form = new FormData();
      form.append('chunk', chunk.chunk);
      form.append('hash', chunk.hash);
      form.append('name', chunk.name);
      return { form, index: chunk.index, error: 0 };
    }).map(({ form, index }) => axios.post('/api/uploadSlice', form, {
      onUploadProgress: progress => {
        // 不是整体的进度条了，而是每个区块有自己的进度条，整体的进度条需要计算
        chunks[index].progress = Number(
          ((progress.loaded / progress.total) * 100).toFixed(2)
        );
      }
    }));
    await Promise.all(requests);
  }

  mergeRequest = async (hash) => {
    const { file } = this.state;
    await axios.post('/api/mergeFile', {
      ext: file.name.split('.').pop(),
      size: CHUNK_SIZE,
      hash
    });
  }

  render() {
    const { progress, hashProgress, loading } = this.state;
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
      </div>
    );
  }
}

export default UploadFile;