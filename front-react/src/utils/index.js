// https://www.jianshu.com/p/45c0f85c47ed

const blobToString = async (blob) => new Promise(resolve => {
  const reader = new FileReader();
  reader.onload = () => {
    const ret = reader.result.split('')
      .map(v => v.charCodeAt())
      .map(v => v.toString(16).toUpperCase())
      .map(v => v.padStart(2, '0'))
      .join(' ');
    resolve(ret);
  };
  reader.readAsBinaryString(blob);
});

const isGif = async (file) => {
  // GIF89a 和GIF87a
  // 前面6个16进制，'47 49 46 38 39 61' '47 49 46 38 37 61'
  // 16进制
  const ret = await blobToString(file.slice(0, 6));
  const gif = (ret === '47 49 46 38 39 61') || (ret === '47 49 46 38 37 61');
  return gif;
};

const isPng = async (file) => {
  const ret = await blobToString(file.slice(0, 8));
  const png = (ret === '89 50 4E 47 0D 0A 1A 0A');
  return png;
};
const isJpg = async (file) => {
  const len = file.size;
  const start = await blobToString(file.slice(0, 2));
  const tail = await blobToString(file.slice(-2, len));
  const jpg = (start === 'FF D8') && (tail === 'FF D9');
  return jpg;
};
const isImage = async (file) => {
  // 通过文件流来判定
  // 先判定是不是gif
  const png = await isPng(file);
  const gif = await isGif(file);
  return png || gif;
};

export {
  blobToString,
  isGif,
  isPng,
  isJpg,
  isImage
};