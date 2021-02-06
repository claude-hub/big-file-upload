import React, { PureComponent } from 'react';
import { Button } from 'antd';
import axios from 'axios';

class UploadFile extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      file: null
    };
  }

  // componentDidMount() {
  //   axios.get('/api/user');
  // }

  handleChange = (e) => {
    const [file] = e.target.files;
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
    const res = axios.post('/api/upload', from);
    console.log(res);
  }

  render() {
    const { file } = this.state;
    return (
      <div>
        <input type="file" onChange={this.handleChange} />
        <Button type="primary" onClick={this.handleClick}>Upload</Button>
      </div>
    );
  }
}

export default UploadFile;