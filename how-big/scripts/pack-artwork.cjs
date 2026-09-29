// Run with sharp installed: node how-big/scripts/pack-artwork.cjs [source-directory]
// Converts generated transparent PNGs without changing their artwork.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), sharp = require('sharp');
const dest = path.resolve(__dirname, '../assets/stickers-v1');
const source = process.argv[2] || dest;
const ctx = {window: {}};
vm.runInNewContext(fs.readFileSync(path.join(dest, 'manifest.js'), 'utf8'), ctx);
const manifest = ctx.window.HOW_BIG_SPRITES;
(async () => {
  for (const file of fs.readdirSync(source).filter(f => f.endsWith('.png'))) {
    const id = path.basename(file, '.png'), out = path.join(dest, id + '.webp');
    if (fs.existsSync(out)) continue;
    await sharp(path.join(source, file)).resize({width: 640, height: 640, fit: 'inside', withoutEnlargement: true}).webp({quality: 88, alphaQuality: 100}).toFile(out);
    const {data, info} = await sharp(out).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    let x0=info.width, y0=info.height, x1=-1, y1=-1;
    for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) if(data[(y*info.width+x)*4+3]>=128) {
      x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,y); y1=Math.max(y1,y);
    }
    if(x1<x0 || y1<y0) throw new Error('Empty sprite: '+id);
    manifest[id]={src:'assets/stickers-v1/'+id+'.webp',bounds:[x0,y0,x1-x0+1,y1-y0+1]};
  }
  fs.writeFileSync(path.join(dest,'manifest.js'),'// Visible-object bounds keep transparent padding out of measurements.\nwindow.HOW_BIG_SPRITES = '+JSON.stringify(manifest,null,2)+';\n');
  console.log(Object.keys(manifest).length+' sprites packed');
})();
