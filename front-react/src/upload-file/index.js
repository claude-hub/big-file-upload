import React, { PureComponent } from 'react';
import { Button, Progress, message } from 'antd';
import axios from 'axios';
import { isImage } from '../utils';

class UploadFile extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      file: null,
      percent: 0
    };
  }

  handleChange = async (e) => {
    const [file] = e.target.files;
    console.log(file);
    if (!await isImage(file)) {
      message.error({
        content: '文件不是gif和png格式'
      });
    } else {
      message.success({
        content: '文件格式正确'
      });
    }
    if (!file) return;
    this.setState({
      file
    });
  }

  handleClick = () => {
    const { file } = this.state;
    const from = new FormData();
    from.append('name', 'file');
    from.append('file', file);
    const res = axios.post('/api/upload', from, {
      onUploadProgress: progress => {
        const { loaded, total } = progress;
        const percent = Number(((loaded / total) * 100).toFixed(2));
        this.setState({
          percent
        });
      }
    });
    console.log(res);
  }

  render() {
    const { percent } = this.state;
    return (
      <div style={{ width: 300, padding: '60px 32px', margin: 'auto' }}>
        <input type="file" onChange={this.handleChange} />
        <Progress percent={percent} />
        <Button type="primary" size="small" onClick={this.handleClick}>Upload</Button>
      </div>
    );
  }
}

export default UploadFile;