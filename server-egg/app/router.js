'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  router.get('/', controller.home.index);
  router.get('/user', controller.home.index);
  router.post('/upload', controller.home.upload);

  router.post('/uploadSlice', controller.home.uploadSlice);
  router.post('/mergeFile', controller.home.mergeFile);
  router.post('/checkFile', controller.home.checkFile);

};
