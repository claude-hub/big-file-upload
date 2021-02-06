'use strict';

const BaseController = require('./base');
const fes = require('fs-extra');

class HomeController extends BaseController {
  async index() {
    const { ctx } = this;
    ctx.body = 'hi, egg';
  }

  async upload() {
    const { ctx } = this;
    const file = ctx.request.files[0];
    const filePath = `${this.config.UPLOAD_DIR}/${file.filename}`;
    await fes.move(file.filepath, filePath);
    this.success({
      url: `/public/${file.filename}`,
    });
  }
}

module.exports = HomeController;
