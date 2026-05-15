
const fs = require('fs');
const props = JSON.parse(fs.readFileSync('/public/Texture/propsmap.json', 'utf8'));
const textures = {};

props.frames.forEach((f, i) => {
  const id = 24 + i;
  textures[id] = {
    name: f.filename,
    x1: f.frame.x,
    y1: f.frame.y,
    x2: f.frame.x + f.frame.w - 1,
    y2: f.frame.y + f.frame.h - 1,
    fileName: 'propsmap.png'
  };
});

console.log(JSON.stringify(textures, null, 2));
