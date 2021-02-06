'use strict';

const Controller = require('egg').Controller;

class HomeController extends Controller {
  async index() {
    const { ctx } = this;
    ctx.body = 'hi, egg';
  }

  async upload() {
    const { ctx } = this;
    console.log(ctx);
    const file = ctx.request.files[0];
    const { name } = ctx.request.body;
    console.log(name, file);
    ctx.body = 'hi, egg';
  }
}

module.exports = HomeController;
