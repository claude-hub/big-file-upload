/* eslint-disable no-restricted-globals */
// 引入spark-md5
self.importScripts('spark-md5.min.js');

// 增量计算整个文件的hash值
self.onmessage = e => {
  // 接受主线程传递的数据
  const { chunks } = e.data;
  const spark = new self.SparkMD5.ArrayBuffer();

  let progress = 0;
  let count = 0;

  // 一小块小块的计算hash值，然后计算完所有文件后，返回最终hash
  const loadNext = index => {
    const reader = new FileReader();
    reader.readAsArrayBuffer(chunks[index].file);
    reader.onload = event => {
      count += 1;
      spark.append(event.target.result);

      if (count === chunks.length) {
        // 计算完整个文件后, 返回进度条100%, 以及整个文件的最终hash
        self.postMessage({
          progress: 100,
          hash: spark.end()
        });
      } else {
        // 进度条模拟，每块上传完后，进度条应该加好多
        progress += 100 / chunks.length;
        self.postMessage({
          progress
        });
        // 递归继续计算
        loadNext(count);
      }
    };
  };
  loadNext(0);
};