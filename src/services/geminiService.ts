import { GoogleGenAI, Type } from "@google/genai";
import { Entity } from '../context/GameContext';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function generateMap(stage: number, theme: string = "forest", options: { hasNPC?: boolean, enemyType?: string } = {}) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `你是一個遊戲關卡設計師。你的任務是生成一個 10x10 的遊戲地圖。
地圖包含三個矩陣：
1. grid: 10x10 的地形類型 (0:草地, 1:牆壁, 2:建築, 3:樓梯, 4:高地)
2. textureGrid: 10x10 的基礎地面材質 ID (必須嚴格僅限 1-23，絕對不能填入 24 以上的 ID)
3. objectGrid: 10x10 的獨立物件材質 ID (必須僅限 24-96，若無物件則填 0)

材質分類指南:
- 地面 (用於 textureGrid, 1-23):
  * 1-6: 草地系列 (1:純草地, 2-4:雜草/碎石, 5-6:花簇)
  * 7-12: 石磚路系列 (12: 出口地磚，每張地圖必須有一個)
  * 13-23: 巨型石磚與裝飾地磚
- 物件 (用於 objectGrid, 24-96):
  * 樹木 (不可通行): 24 (大), 25 (中), 26 (小)
  * 灌木/植物 (不可通行): 28-33
  * 障礙物 (不可通行): 34 (石碑), 35 (陶罐), 36 (墓碑), 37 (石柱), 39-40 (寶箱), 41 (告示牌), 43 (木車), 44-46 (牆柱), 48 (石盆), 49 (牆壁殘骸), 51 (圓形牆), 52 (石塊), 54 (木桶), 56 (木箱), 68 (大岩石), 82-83 (石牆), 84 (橋柱), 87 (牆架), 89-90 (牆壁隔板), 94-96 (磚牆)
  * 裝飾/結構 (可通行): 27 (碎片), 50 (符文平台), 62-63 (碎石), 64-65 (木板), 69 (碎片), 70-71 (小石子), 74-75 (瓦礫), 76 (踏腳石), 77 (石樓梯), 78-79 (樓梯), 80 (拱橋中心), 81 (樓梯), 85-86 (斜向樓梯)
  * 其他道具 (不可通行): 38, 42, 47, 53, 55, 57-61, 66-67, 72-73

設計原則：
- 必須先在 textureGrid (1-23) 鋪設完整的地面。
- objectGrid (24-96) 用於放置樹木、牆壁、裝飾品。請【極少量】放置，不要填滿地圖。地圖應保持 70% 以上的空地。
- 戰鬥區域必須開闊：地圖中心區域 (3,3 到 7,7) 嚴禁放置任何不可通行的障礙物 (如樹木、牆壁)。
- 敵人生成點安全：地圖的四個角落 (0,0), (0,9), (9,0), (9,9) 及其鄰近格子嚴禁放置障礙物，確保敵人不會卡住。
- 樹木 (24-26) 和牆壁 (82-83, 87, 94-96) 是主要的不可通行障礙，請確保不會阻擋玩家通往出口的唯一路徑。
- 樓梯 (77, 78, 79, 81, 85, 86) 應配合 grid 中的樓梯類型 (3) 使用，且必須是可通行的。
- 必須包含一個出口 (材質 12 放在 textureGrid)。
- 確保地圖是連通的，玩家可以從起點走到出口。
- 物件會置於格子中心，大物件（如樹）會遮擋上方格子，但不影響上方格子的通行。
- 嚴禁在 textureGrid 中使用 24-96 的 ID，否則會導致渲染錯誤。

NPC 與 首領(Boss) 放置：
- 請根據關卡設計決定是否生成 NPC 或 Boss。不一定每層都有。
- 如果有 NPC，請放入 npcs 陣列。
- 如果有 Boss，請放入 bosses 陣列。
- 請在 description 中詳細描述地圖的氛圍、NPC/Boss 的身份以及敵人的類型。

請以 JSON 格式回覆：
{
  "width": 10,
  "height": 10,
  "grid": [[...], ...],
  "textureGrid": [[...], ...],
  "objectGrid": [[...], ...],
  "description": "地圖的文字描述",
  "npcs": [ { "name": "NPC名字", "avatar": "emoji", "x": 數字, "y": 數字 } ],
  "bosses": [ { "name": "Boss名字", "avatar": "emoji", "x": 數字, "y": 數字 } ],
  "enemies": [ { "name": "敵人名字", "avatar": "emoji", "x": 數字, "y": 數字 } ]
}
注意：x, y 必須在 0-9 之間，且不能在障礙物上。Boss 的佔地大小為 2x2，所以 Boss 的 x, y 必須在 0-8 之間，且其佔用的 4 個格子都不能有障礙物。`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: `請為第 ${stage} 層生成一個「${theme}」主題的地圖。請根據關卡設計決定是否加入 NPC 或 Boss。敵人類型應為「${options.enemyType || '普通怪物'}」。`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            width: { type: Type.INTEGER },
            height: { type: Type.INTEGER },
            grid: { 
              type: Type.ARRAY, 
              items: { type: Type.ARRAY, items: { type: Type.INTEGER } } 
            },
            textureGrid: { 
              type: Type.ARRAY, 
              items: { type: Type.ARRAY, items: { type: Type.INTEGER } } 
            },
            objectGrid: { 
              type: Type.ARRAY, 
              items: { type: Type.ARRAY, items: { type: Type.INTEGER } } 
            },
            description: { type: Type.STRING },
            npcs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  avatar: { type: Type.STRING },
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER }
                },
                required: ["name", "avatar", "x", "y"]
              }
            },
            bosses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  avatar: { type: Type.STRING },
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER }
                },
                required: ["name", "avatar", "x", "y"]
              }
            },
            enemies: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  avatar: { type: Type.STRING },
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER }
                },
                required: ["name", "avatar", "x", "y"]
              }
            },
            chests: {
              type: Type.ARRAY,
              description: "寶箱，30%機率出現",
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.INTEGER },
                  y: { type: Type.INTEGER }
                },
                required: ["x", "y"]
              }
            }
          },
          required: ["width", "height", "grid", "textureGrid", "objectGrid", "description"]
        }
      }
    });

    return JSON.parse(result.text || "{}");

  } catch (error) {
    console.error("Map Generation Error:", error);
    return null;
  }
}

export async function getNPCDialogueResponse(npc: Entity, history: { role: 'npc' | 'player'; content: string }[], playerInput: string) {
  const model = "gemini-3-flash-preview";
  
  const isBoss = npc.type === 'boss_npc';
  const isDefeated = npc.hp <= 0;
  const memoryText = npc.memory && npc.memory.length > 0 ? `你的記憶：\n${npc.memory.join('\n')}` : '';

  const systemInstruction = `你是一個奇幻RPG遊戲中的${isBoss ? '首領(Boss)' : 'NPC'}，名字是${npc.name}。
你的任務是根據玩家的輸入進行對話，並決定接下來的劇情發展。

當前狀態：
- 你是否已經被玩家擊敗過：${isDefeated ? '是' : '否'}
${memoryText}

對話風格與行為要求：
1. 你應該主動生成一些任務或委託，並在聊天時向玩家提出。如果玩家達成，你可以給予物品。
2. 即使玩家未完成任務，在合理情況下（例如玩家成功說服你，或者打劫你），你也可以交出物品，但不一定會成功。
3. 如果你已經被玩家擊敗過（HP <= 0），你應該留在原地並記住剛剛的戰鬥。你可以表現出屈服、憤怒或敬畏，玩家甚至可以對你進行打劫。
4. ${isBoss ? '你是首領(Boss)，絕對不能加入玩家陣營。' : '你可以選擇加入玩家陣營 (JOIN_TEAM)。'}
5. 如果你決定交出物品，請選擇 GIVE_ITEM 動作。交出物品後你將會從地圖上消失。

你可以選擇的動作 (action)：
1. CONTINUE: 繼續對話。
2. START_BATTLE: 因為被冒犯、劇情需要或玩家打劫失敗而發動戰鬥。
3. ${isBoss ? 'CONTINUE' : 'JOIN_TEAM'}: 因為感動、回憶起往事或志同道合而決定加入玩家隊伍。
4. GIVE_ITEM: 給予玩家物品（如任務獎勵、被說服或被打劫交出物品）。
5. END_DIALOGUE: 結束對話。

請以JSON格式回覆：
{
  "response": "你說的話",
  "action": "CONTINUE" | "START_BATTLE" | "JOIN_TEAM" | "GIVE_ITEM" | "END_DIALOGUE",
  "log": "戰鬥日誌中顯示的劇情描述",
  "item": {
    "name": "物品名稱",
    "description": "物品描述",
    "icon": "物品圖標 (必須僅限一個 emoji)"
  },
  "battle_config": {
    "enemy_name": "敵人名稱",
    "enemy_avatar": "敵人頭像 (必須僅限一個 emoji)",
    "enemy_hp_mult": 1.0,
    "enemy_count": 1
  }
}
注意：如果選擇 JOIN_TEAM 或 GIVE_ITEM，請在 log 中詳細描述原因。如果選擇 START_BATTLE，請務必提供 battle_config。如果選擇 GIVE_ITEM，請務必提供 item。`;

  const contents = history.map(h => ({
    role: h.role === 'npc' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));
  
  contents.push({
    role: 'user',
    parts: [{ text: playerInput }]
  });

  try {
    const result = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            response: { type: Type.STRING },
            action: { type: Type.STRING, enum: ["CONTINUE", "START_BATTLE", "JOIN_TEAM", "GIVE_ITEM", "END_DIALOGUE"] },
            log: { type: Type.STRING },
            item: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                icon: { type: Type.STRING }
              },
              required: ["name", "description", "icon"]
            },
            battle_config: {
              type: Type.OBJECT,
              properties: {
                enemy_name: { type: Type.STRING },
                enemy_avatar: { type: Type.STRING, description: "必須只有一個 emoji" },
                enemy_hp_mult: { type: Type.NUMBER },
                enemy_count: { type: Type.INTEGER, description: "敵人數量，1-8" }
              },
              required: ["enemy_name", "enemy_avatar", "enemy_hp_mult", "enemy_count"]
            },
            npc_skills: {
              type: Type.ARRAY,
              description: "如果 action 是 JOIN_TEAM，請根據該 NPC 的特性生成 4~9 個專屬技能",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['AREA', 'CROSS', 'SELF', 'LINE', 'SINGLE', 'ROW_1', 'ROW_3', 'COL_1', 'COL_3', 'AROUND_1', 'AROUND_2', 'CHAIN', 'PINCER_ONLY', 'ALL_ENEMIES', 'ALL_ALLIES', 'LOWEST_HP'] },
                  category: { type: Type.STRING, enum: ['PHYSICAL', 'MAGIC', 'HEAL', 'BUFF'] },
                  damage: { type: Type.INTEGER, description: "傷害或治療量，0~500" },
                  sp_cost: { type: Type.INTEGER, description: "SP消耗，0~50" },
                  base_trigger_rate: { type: Type.INTEGER, description: "觸發機率，0~100" }
                },
                required: ["name", "description", "type", "category", "damage", "sp_cost", "base_trigger_rate"]
              }
            }
          },
          required: ["response", "action", "log"]
        }
      }
    });

    return JSON.parse(result.text || "{}");
  } catch (error) {
    console.error("Gemini API Error:", error);
    return {
      response: "我現在有點頭暈，晚點再說吧...",
      action: "END_DIALOGUE",
      log: "NPC 似乎不太舒服。"
    };
  }
}

export async function generateCharacterSkills(characterName: string, jobType: string, level: number) {
  const model = "gemini-3.1-flash-preview";

  const systemInstruction = `你是一個遊戲技能設計師。請為這個角色設計 4 到 9 個專屬技能。
角色的名字是 ${characterName}，職業是 ${jobType}，目前等級是 ${level}。
請根據角色的職業和等級，設計出符合其特性的技能。
技能的傷害/治療量應該與等級相符（等級越高，數值越大，大約是 10 + 等級 * 5 到 50 + 等級 * 20 之間）。
SP消耗大約在 5 到 30 之間。
觸發機率大約在 30 到 100 之間。`;

  try {
    const result = await ai.models.generateContent({
      model,
      contents: "請為這個角色生成專屬技能。",
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            skills: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ['AREA', 'CROSS', 'SELF', 'LINE', 'SINGLE', 'ROW_1', 'ROW_3', 'COL_1', 'COL_3', 'AROUND_1', 'AROUND_2', 'CHAIN', 'PINCER_ONLY', 'ALL_ENEMIES', 'ALL_ALLIES', 'LOWEST_HP'] },
                  category: { type: Type.STRING, enum: ['PHYSICAL', 'MAGIC', 'HEAL', 'BUFF'] },
                  damage: { type: Type.INTEGER, description: "傷害或治療量" },
                  sp_cost: { type: Type.INTEGER, description: "SP消耗" },
                  base_trigger_rate: { type: Type.INTEGER, description: "觸發機率，0~100" }
                },
                required: ["name", "description", "type", "category", "damage", "sp_cost", "base_trigger_rate"]
              }
            }
          },
          required: ["skills"]
        }
      }
    });

    return JSON.parse(result.text || "{}").skills || [];
  } catch (error) {
    console.error("Gemini API Error generating skills:", error);
    return [];
  }
}
