import React, { PureComponent } from 'react';
import { Button, Progress, message } from 'antd';
import axios from 'axios';
import { isImage } from '../utils';

const CHUNK_SIZE = 1 * 1024 * 1024;
class UploadFile extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      file: null,
      progress: 0,
      hashProgress: 0,
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
    console.log(chunks, hash);
    this.setState({
      loading: false
    });
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

  async calculateHashWorker(chunks) {
    return new Promise(resolve => {
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