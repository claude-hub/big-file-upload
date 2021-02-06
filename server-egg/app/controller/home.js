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
    // 报错
    // if (Math.random() > 0.3) {
    //   // eslint-disable-next-line no-return-assign
    //   return ctx.status = 500;
    // }

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

  async checkFile() {
    const { ctx } = this;
    const { ext, hash } = ctx.request.body;
    const filePath = path.resolve(this.config.UPLOAD_DIR, `${hash}.${ext}`);

    let uploaded = false;
    let uploadedList = [];
    if (fse.existsSync(filePath)) {
      // 文件存在
      uploaded = true;
    } else {
      uploadedList = await this.getUploadedList(path.resolve(this.config.UPLOAD_DIR, hash));
    }
    this.success({
      uploaded,
      uploadedList,
    });
  }

  async getUploadedList(dirPath) {
    return fse.existsSync(dirPath)
      ? (await fse.readdir(dirPath)).filter(name => name[0] !== '.')
      : [];
  }
}

module.exports = HomeController;
