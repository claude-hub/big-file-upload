'use strict';

const BaseController = require('./base');
const fse = require('fs-extra');
const path = require('path');

class HomeController extends BaseController {
  async index() {
    const { ctx } = this;
    ctx.body = 'hi, egg';
  }

  async upload() {
    const { ctx } = this;
    const file = ctx.request.files[0];
    const filePath = `${this.config.UPLOAD_DIR}/${file.filename}`;
    await fse.move(file.filepath, filePath);
    this.success({
      url: `/public/upload/${file.filename}`,
    });
  }

  async uploadSlice() {
    const { ctx } = this;
    const file = ctx.request.files[0];
    const { hash, name } = ctx.request.body;
    const chunkPath = path.resolve(this.config.UPLOAD_DIR, hash);
    if (!fse.existsSync(chunkPath)) {
      await fse.mkdir(chunkPath);
    }
    await fse.move(file.filepath, `${chunkPath}/${name}`);
    this.message('切片上传成功');
  }

  async mergeFile() {
    const { ext, size, hash } = this.ctx.request.body;
    const filePath = path.resolve(this.config.UPLOAD_DIR, `${hash}.${ext}`);
    await this.ctx.service.tools.mergeFile(filePath, hash, size);
    this.success({
      url: `/public/upload/${hash}.${ext}`,
    });
  }
}

module.exports = HomeController;
