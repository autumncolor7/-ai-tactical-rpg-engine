export interface TextureInfo {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  fileName: string;
}

export const TEXTURES: Record<number, TextureInfo> = {
  // Terrain (1-23) from TXMap.csv
  1: { name: '純草地(基礎)', x1: 0, y1: 0, x2: 31, y2: 31, fileName: 'TX Tileset Grass.png' },
  2: { name: '草地(疏雜草)', x1: 32, y1: 0, x2: 63, y2: 31, fileName: 'TX Tileset Grass.png' },
  3: { name: '草地(密雜草)', x1: 64, y1: 0, x2: 95, y2: 31, fileName: 'TX Tileset Grass.png' },
  4: { name: '草地(小碎石)', x1: 96, y1: 0, x2: 127, y2: 31, fileName: 'TX Tileset Grass.png' },
  5: { name: '草地(白花簇)', x1: 128, y1: 0, x2: 159, y2: 31, fileName: 'TX Tileset Grass.png' },
  6: { name: '草地(黃花簇)', x1: 192, y1: 0, x2: 223, y2: 31, fileName: 'TX Tileset Grass.png' },
  7: { name: '完整石磚路(左上)', x1: 0, y1: 128, x2: 31, y2: 159, fileName: 'TX Tileset Grass.png' },
  8: { name: '完整石磚路(中上)', x1: 32, y1: 128, x2: 63, y2: 159, fileName: 'TX Tileset Grass.png' },
  9: { name: '石磚路(左側邊緣)', x1: 0, y1: 160, x2: 31, y2: 191, fileName: 'TX Tileset Grass.png' },
  10: { name: '獨立石磚(草地中)', x1: 128, y1: 160, x2: 159, y2: 191, fileName: 'TX Tileset Grass.png' },
  11: { name: '石磚路(右側邊緣)', x1: 192, y1: 128, x2: 223, y2: 159, fileName: 'TX Tileset Grass.png' },
  12: { name: '路徑終端(半碎石)', x1: 224, y1: 224, x2: 255, y2: 255, fileName: 'TX Tileset Grass.png' },
  13: { name: '巨型石磚(左上)', x1: 0, y1: 0, x2: 63, y2: 63, fileName: 'TX Tileset Stone Ground.png' },
  14: { name: '邊緣裝飾石條(上)', x1: 64, y1: 0, x2: 95, y2: 63, fileName: 'TX Tileset Stone Ground.png' },
  15: { name: '直向銜接石柱', x1: 96, y1: 0, x2: 127, y2: 63, fileName: 'TX Tileset Stone Ground.png' },
  16: { name: '完整方形大石塊', x1: 128, y1: 0, x2: 191, y2: 63, fileName: 'TX Tileset Stone Ground.png' },
  17: { name: '巨型石磚(左下)', x1: 0, y1: 64, x2: 63, y2: 127, fileName: 'TX Tileset Stone Ground.png' },
  18: { name: '邊緣裝飾石條(下)', x1: 64, y1: 64, x2: 95, y2: 127, fileName: 'TX Tileset Stone Ground.png' },
  19: { name: '石牆填充區塊', x1: 128, y1: 128, x2: 191, y2: 191, fileName: 'TX Tileset Stone Ground.png' },
  20: { name: '帶孔洞裝飾石塊', x1: 0, y1: 160, x2: 63, y2: 223, fileName: 'TX Tileset Stone Ground.png' },
  21: { name: '單一方形裝飾塊', x1: 128, y1: 160, x2: 191, y2: 223, fileName: 'TX Tileset Stone Ground.png' },
  22: { name: '十字型路徑節點', x1: 192, y1: 128, x2: 255, y2: 191, fileName: 'TX Tileset Stone Ground.png' },
  23: { name: '丁字型路徑節點', x1: 192, y1: 192, x2: 255, y2: 255, fileName: 'TX Tileset Stone Ground.png' },

  // Props (24-96) from propsmap.json
  24: { name: 'tree-large', x1: 1, y1: 1, x2: 113, y2: 139, fileName: 'propsmap.png' },
  25: { name: 'tree-medium', x1: 1, y1: 142, x2: 97, y2: 277, fileName: 'propsmap.png' },
  26: { name: 'tree-small', x1: 99, y1: 280, x2: 177, y2: 399, fileName: 'propsmap.png' },
  27: { name: 'pixel-debris-1', x1: 1, y1: 508, x2: 2, y2: 509, fileName: 'propsmap.png' },
  28: { name: 'bush-small-1', x1: 401, y1: 75, x2: 422, y2: 93, fileName: 'propsmap.png' },
  29: { name: 'bush-small-2', x1: 188, y1: 248, x2: 214, y2: 272, fileName: 'propsmap.png' },
  30: { name: 'bush-medium-1', x1: 180, y1: 375, x2: 217, y2: 406, fileName: 'propsmap.png' },
  31: { name: 'bush-large', x1: 330, y1: 284, x2: 376, y2: 325, fileName: 'propsmap.png' },
  32: { name: 'bush-medium-2', x1: 313, y1: 328, x2: 351, y2: 372, fileName: 'propsmap.png' },
  33: { name: 'bush-small-3', x1: 314, y1: 99, x2: 353, y2: 133, fileName: 'propsmap.png' },
  34: { name: 'stone-sign-rock', x1: 388, y1: 342, x2: 419, y2: 387, fileName: 'propsmap.png' },
  35: { name: 'pot-ceramic-large', x1: 275, y1: 477, x2: 306, y2: 507, fileName: 'propsmap.png' },
  36: { name: 'tombstone-tall-cross', x1: 462, y1: 287, x2: 493, y2: 332, fileName: 'propsmap.png' },
  37: { name: 'pillar-broken', x1: 399, y1: 288, x2: 424, y2: 339, fileName: 'propsmap.png' },
  38: { name: 'bench-stone', x1: 116, y1: 99, x2: 171, y2: 139, fileName: 'propsmap.png' },
  39: { name: 'chest-open', x1: 428, y1: 280, x2: 459, y2: 328, fileName: 'propsmap.png' },
  40: { name: 'chest-closed', x1: 234, y1: 99, x2: 259, y2: 137, fileName: 'propsmap.png' },
  41: { name: 'signpost-east-west', x1: 252, y1: 409, x2: 277, y2: 474, fileName: 'propsmap.png' },
  42: { name: 'tomb-stone-base', x1: 217, y1: 239, x2: 280, y2: 274, fileName: 'propsmap.png' },
  43: { name: 'cart-wood', x1: 428, y1: 228, x2: 468, y2: 277, fileName: 'propsmap.png' },
  44: { name: 'wall-pillar-tall-1', x1: 399, y1: 162, x2: 425, y2: 222, fileName: 'propsmap.png' },
  45: { name: 'statue-praying', x1: 316, y1: 1, x2: 352, y2: 73, fileName: 'propsmap.png' },
  46: { name: 'wall-pillar-tall-2', x1: 399, y1: 225, x2: 425, y2: 285, fileName: 'propsmap.png' },
  47: { name: 'lantern-stone', x1: 290, y1: 99, x2: 311, y2: 136, fileName: 'propsmap.png' },
  48: { name: 'pillar-basin', x1: 304, y1: 139, x2: 335, y2: 215, fileName: 'propsmap.png' },
  49: { name: 'wall-ruin-piece', x1: 354, y1: 328, x2: 385, y2: 384, fileName: 'propsmap.png' },
  50: { name: 'platform-circular-runes', x1: 355, y1: 1, x2: 448, y2: 72, fileName: 'propsmap.png' },
  51: { name: 'wall-circular-ruins', x1: 451, y1: 45, x2: 505, y2: 93, fileName: 'propsmap.png' },
  52: { name: 'block-stone-square', x1: 428, y1: 331, x2: 459, y2: 376, fileName: 'propsmap.png' },
  53: { name: 'pot-small-1', x1: 278, y1: 375, x2: 298, y2: 406, fileName: 'propsmap.png' },
  54: { name: 'barrel-wood', x1: 283, y1: 237, x2: 310, y2: 272, fileName: 'propsmap.png' },
  55: { name: 'tombstone-arched', x1: 262, y1: 99, x2: 287, y2: 136, fileName: 'propsmap.png' },
  56: { name: 'crates-stacked', x1: 471, y1: 228, x2: 502, y2: 284, fileName: 'propsmap.png' },
  57: { name: 'pot-small-2', x1: 252, y1: 477, x2: 272, y2: 510, fileName: 'propsmap.png' },
  58: { name: 'tombstone-rip', x1: 174, y1: 99, x2: 203, y2: 139, fileName: 'propsmap.png' },
  59: { name: 'tombstone-small', x1: 100, y1: 248, x2: 129, y2: 276, fileName: 'propsmap.png' },
  60: { name: 'rock-small-1', x1: 161, y1: 248, x2: 185, y2: 274, fileName: 'propsmap.png' },
  61: { name: 'tombstone-cross', x1: 206, y1: 99, x2: 231, y2: 138, fileName: 'propsmap.png' },
  62: { name: 'rubble-small-1', x1: 349, y1: 76, x2: 372, y2: 94, fileName: 'propsmap.png' },
  63: { name: 'rubble-small-2', x1: 375, y1: 75, x2: 398, y2: 93, fileName: 'propsmap.png' },
  64: { name: 'wood-plank-vertical-1', x1: 372, y1: 162, x2: 380, y2: 214, fileName: 'propsmap.png' },
  65: { name: 'wood-plank-vertical-2', x1: 383, y1: 162, x2: 391, y2: 214, fileName: 'propsmap.png' },
  66: { name: 'rock-small-2', x1: 220, y1: 375, x2: 246, y2: 406, fileName: 'propsmap.png' },
  67: { name: 'rock-small-3', x1: 249, y1: 375, x2: 275, y2: 406, fileName: 'propsmap.png' },
  68: { name: 'rock-cluster-large', x1: 451, y1: 1, x2: 507, y2: 42, fileName: 'propsmap.png' },
  69: { name: 'pixel-debris-2', x1: 5, y1: 508, x2: 5, y2: 508, fileName: 'propsmap.png' },
  70: { name: 'rock-tiny-1', x1: 356, y1: 113, x2: 366, y2: 122, fileName: 'propsmap.png' },
  71: { name: 'rock-tiny-2', x1: 356, y1: 97, x2: 371, y2: 110, fileName: 'propsmap.png' },
  72: { name: 'rock-medium', x1: 301, y1: 375, x2: 327, y2: 396, fileName: 'propsmap.png' },
  73: { name: 'pot-round', x1: 132, y1: 248, x2: 158, y2: 274, fileName: 'propsmap.png' },
  74: { name: 'rock-tiny-3', x1: 425, y1: 75, x2: 442, y2: 90, fileName: 'propsmap.png' },
  75: { name: 'rock-tiny-4', x1: 304, y1: 218, x2: 322, y2: 233, fileName: 'propsmap.png' },
  76: { name: 'stepping-stones', x1: 316, y1: 76, x2: 346, y2: 94, fileName: 'propsmap.png' },
  77: { name: 'stairs-vertical-stone', x1: 216, y1: 141, x2: 279, y2: 236, fileName: 'propsmap.png' },
  78: { name: 'stairs-mossy-left', x1: 180, y1: 277, x2: 244, y2: 372, fileName: 'propsmap.png' },
  79: { name: 'stairs-vertical-stone-long', x1: 185, y1: 409, x2: 249, y2: 504, fileName: 'propsmap.png' },
  80: { name: 'archway-bridge-center', x1: 280, y1: 409, x2: 359, y2: 472, fileName: 'propsmap.png' },
  81: { name: 'stairs-mossy-right', x1: 247, y1: 277, x2: 310, y2: 372, fileName: 'propsmap.png' },
  82: { name: 'wall-stone-left', x1: 116, y1: 1, x2: 180, y2: 96, fileName: 'propsmap.png' },
  83: { name: 'wall-stone-right', x1: 183, y1: 1, x2: 247, y2: 96, fileName: 'propsmap.png' },
  84: { name: 'archway-bridge-pillar', x1: 362, y1: 409, x2: 425, y2: 472, fileName: 'propsmap.png' },
  85: { name: 'stairs-diagonal-left', x1: 1, y1: 410, x2: 90, y2: 505, fileName: 'propsmap.png' },
  86: { name: 'stairs-diagonal-right', x1: 93, y1: 410, x2: 182, y2: 505, fileName: 'propsmap.png' },
  87: { name: 'wall-frame-square', x1: 1, y1: 280, x2: 96, y2: 407, fileName: 'propsmap.png' },
  88: { name: 'wall-frame-window', x1: 100, y1: 142, x2: 213, y2: 245, fileName: 'propsmap.png' },
  89: { name: 'wall-divider-left', x1: 282, y1: 139, x2: 291, y2: 234, fileName: 'propsmap.png' },
  90: { name: 'wall-divider-right', x1: 294, y1: 139, x2: 301, y2: 234, fileName: 'propsmap.png' },
  91: { name: 'wall-ledge-horizontal', x1: 301, y1: 399, x2: 396, y2: 406, fileName: 'propsmap.png' },
  92: { name: 'wall-window-inset', x1: 250, y1: 1, x2: 313, y2: 96, fileName: 'propsmap.png' },
  93: { name: 'wall-brick-horizontal', x1: 375, y1: 96, x2: 502, y2: 159, fileName: 'propsmap.png' },
  94: { name: 'wall-brick-pillar-short', x1: 338, y1: 136, x2: 369, y2: 199, fileName: 'propsmap.png' },
  95: { name: 'wall-brick-square-1', x1: 428, y1: 162, x2: 491, y2: 225, fileName: 'propsmap.png' },
  96: { name: 'wall-brick-square-2', x1: 330, y1: 218, x2: 393, y2: 281, fileName: 'propsmap.png' },
};

export const isSolidObject = (id: number): boolean => {
  // Terrain (1-23) is always passable
  if (id >= 1 && id <= 23) return false;

  // Explicitly list passable objects (stairs, floors, small debris, bridges)
  const passableIds = new Set([
    27, // pixel-debris-1
    50, // platform-circular-runes
    62, // rubble-small-1
    63, // rubble-small-2
    64, // wood-plank-vertical-1
    65, // wood-plank-vertical-2
    69, // pixel-debris-2
    70, // rock-tiny-1
    71, // rock-tiny-2
    74, // rock-tiny-3
    75, // rock-tiny-4
    76, // stepping-stones
    77, // stairs-vertical-stone
    78, // stairs-mossy-left
    79, // stairs-vertical-stone-long
    80, // archway-bridge-center
    81, // stairs-mossy-right
    85, // stairs-diagonal-left
    86, // stairs-diagonal-right
  ]);

  return !passableIds.has(id);
};

