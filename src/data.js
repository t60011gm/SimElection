// 遊戲資料：台北市 12 行政區、棋盤地標、事件卡
// 座標為大略的經緯度，僅供棋盤配置參考。

export const DISTRICTS = {
  xinyi:    { name: '信義區', voters: 18, color: '#ef5350' },
  wenshan:  { name: '文山區', voters: 22, color: '#66bb6a' },
  daan:     { name: '大安區', voters: 25, color: '#ab47bc' },
  zhongzheng:{ name: '中正區', voters: 13, color: '#ffa726' },
  wanhua:   { name: '萬華區', voters: 15, color: '#8d6e63' },
  zhongshan:{ name: '中山區', voters: 18, color: '#26c6da' },
  datong:   { name: '大同區', voters: 10, color: '#d4e157' },
  beitou:   { name: '北投區', voters: 21, color: '#5c6bc0' },
  shilin:   { name: '士林區', voters: 23, color: '#ec407a' },
  songshan: { name: '松山區', voters: 16, color: '#29b6f6' },
  neihu:    { name: '內湖區', voters: 23, color: '#9ccc65' },
  nangang:  { name: '南港區', voters: 10, color: '#78909c' },
};

// 棋盤上的地標（依行走順序，形成一個環繞台北市的迴圈）
// price：設立競選辦公室的費用（萬元）
export const LANDMARKS = [
  { id: 'start',   name: '台北市政府', type: 'start', district: 'xinyi', lat: 25.0408, lng: 121.5654 },
  { id: 'tp101',   name: '台北101',    district: 'xinyi',    lat: 25.0336, lng: 121.5650, price: 900 },
  { id: 'zoo',     name: '木柵動物園', district: 'wenshan',  lat: 24.9983, lng: 121.5810, price: 450 },
  { id: 'maokong', name: '貓空',       district: 'wenshan',  lat: 24.9680, lng: 121.5880, price: 400 },
  { id: 'ntu',     name: '台大公館',   district: 'daan',     lat: 25.0150, lng: 121.5360, price: 700 },
  { id: 'daanpark',name: '大安森林公園',district: 'daan',    lat: 25.0300, lng: 121.5355, price: 800 },
  { id: 'cks',     name: '中正紀念堂', district: 'zhongzheng',lat: 25.0350, lng: 121.5219, price: 650 },
  { id: 'longshan',name: '龍山寺',     district: 'wanhua',   lat: 25.0372, lng: 121.4999, price: 500 },
  { id: 'ximen',   name: '西門町',     district: 'wanhua',   lat: 25.0421, lng: 121.5081, price: 600 },
  { id: 'tpstation',name: '台北車站',  district: 'zhongzheng',lat: 25.0478, lng: 121.5170, price: 750 },
  { id: 'xingtian',name: '行天宮',     district: 'zhongshan',lat: 25.0630, lng: 121.5339, price: 600 },
  { id: 'dadaocheng',name: '大稻埕',   district: 'datong',   lat: 25.0560, lng: 121.5100, price: 500 },
  { id: 'guandu',  name: '關渡宮',     district: 'beitou',   lat: 25.1173, lng: 121.4627, price: 400 },
  { id: 'hotspring',name: '北投溫泉',  district: 'beitou',   lat: 25.1365, lng: 121.5070, price: 550 },
  { id: 'tianmu',  name: '天母',       district: 'shilin',   lat: 25.1170, lng: 121.5300, price: 600 },
  { id: 'shilinmkt',name: '士林夜市',  district: 'shilin',   lat: 25.0880, lng: 121.5240, price: 550 },
  { id: 'yuanshan',name: '圓山大飯店', district: 'zhongshan',lat: 25.0790, lng: 121.5260, price: 650 },
  { id: 'palace',  name: '故宮博物院', district: 'shilin',   lat: 25.1024, lng: 121.5485, price: 500 },
  { id: 'airport', name: '松山機場',   district: 'songshan', lat: 25.0697, lng: 121.5525, price: 650 },
  { id: 'neihusci',name: '內湖科技園區',district: 'neihu',   lat: 25.0800, lng: 121.5750, price: 700 },
  { id: 'dahu',    name: '大湖公園',   district: 'neihu',    lat: 25.0840, lng: 121.6020, price: 450 },
  { id: 'nangangex',name: '南港展覽館',district: 'nangang',  lat: 25.0566, lng: 121.6170, price: 600 },
  { id: 'raohe',   name: '饒河夜市',   district: 'songshan', lat: 25.0510, lng: 121.5775, price: 550 },
];

// 事件格種類
export const EVENT_TYPES = {
  news:    { name: '新聞事件', icon: '📰', color: '#fdd835', desc: '抽一張新聞事件卡' },
  fund:    { name: '募款餐會', icon: '💰', color: '#43a047', desc: '舉辦募款餐會，獲得競選經費' },
  poll:    { name: '民調中心', icon: '📊', color: '#1e88e5', desc: '最新民調出爐' },
  debate:  { name: '政見辯論會', icon: '🎤', color: '#8e24aa', desc: '選擇你的辯論策略' },
  media:   { name: '媒體專訪', icon: '📺', color: '#00897b', desc: '花錢上節目，指定一區拉抬聲勢' },
  mrt:     { name: '捷運站',   icon: '🚇', color: '#e53935', desc: '搭捷運前往下一個捷運站' },
  traffic: { name: '交通管制', icon: '🚧', color: '#757575', desc: '遇上遊行封路，暫停一回合' },
};

// 事件格依序填入地標之間的空位
export const EVENT_PATTERN = [
  'news', 'fund', 'mrt', 'media', 'news', 'debate', 'poll', 'traffic',
  'news', 'fund', 'media', 'mrt', 'news', 'debate', 'fund', 'poll',
];

// 新聞事件卡
// effect: { all, districts:{id:n}, randomDistricts:[count,n], funds, skip, moveTo }
export const NEWS_CARDS = [
  { title: '社會住宅政策獲好評', text: '你提出的「只租不賣」社宅加碼政策引發熱烈討論。', effect: { all: 3 } },
  { title: '失言風波延燒', text: '一句「台北人都很閒」被剪成短影音瘋傳……', effect: { all: -3 } },
  { title: '捷運環狀線北環政見', text: '承諾加速環狀線北環興建，北區選民振奮。', effect: { districts: { neihu: 6, shilin: 6, beitou: 5 } } },
  { title: '颱風夜親赴災區', text: '颱風來襲，你連夜到抽水站坐鎮，獲得肯定。', effect: { districts: { wanhua: 5, datong: 5, zhongzheng: 4 } } },
  { title: '網紅合作影片爆紅', text: '與 YouTuber 合拍的「一日市長」影片破百萬觀看！', effect: { districts: { daan: 5, wenshan: 5, zhongzheng: 3 }, funds: 100 } },
  { title: '政治獻金爭議', text: '媒體踢爆一筆來源不明的政治獻金，你只好退回並公開說明。', effect: { funds: -400, all: -1 } },
  { title: '企業家大額捐款', text: '知名企業家公開力挺，捐出競選經費。', effect: { funds: 500 } },
  { title: '黨內大老站台', text: '重量級人士為你站台，造勢現場人山人海。', effect: { randomDistricts: [3, 5] } },
  { title: '家人受訪引發同情', text: '狗仔跟拍家人引發反感，同情票湧入。', effect: { all: 2 } },
  { title: '辯論口誤成迷因', text: '「台北好行」被你講成「台北好難行」，網友笑翻但小額捐款湧入。', effect: { districts: { daan: -3, xinyi: -3 }, funds: 300 } },
  { title: '東區門戶計畫', text: '發表「南港—信義東區門戶」都市計畫，產業界叫好。', effect: { districts: { nangang: 6, songshan: 4, xinyi: 4 } } },
  { title: '老屋都更承諾', text: '承諾加速老舊公寓都更，老城區居民期待。', effect: { districts: { wanhua: 5, datong: 5, zhongshan: 4 } } },
  { title: '遭對手抹黑', text: '網路出現大量不實訊息攻擊你，澄清需要時間。', effect: { all: -2 } },
  { title: '宮廟繞境參拜', text: '參加大型宮廟繞境，與鄉親近距離接觸。', effect: { districts: { wanhua: 4, datong: 4, beitou: 4 } } },
  { title: '科技業座談', text: '與內科、南軟廠商座談，提出交通改善方案。', effect: { districts: { neihu: 6, nangang: 5 } } },
  { title: '行程大塞車', text: '車隊卡在市民大道動彈不得，錯過重要行程。', effect: { skip: 1 } },
  { title: '改搭捷運趕行程', text: '你決定改搭捷運，順便與通勤族握手。', effect: { moveTo: 'mrt', all: 1 } },
  { title: '回市政府簽署政見承諾書', text: '在市府前公開簽署政見承諾書。', effect: { moveTo: 'start' } },
  { title: '夜市小吃直播', text: '逛夜市直播吃美食，親民形象加分。', effect: { districts: { shilin: 4, songshan: 4, wanhua: 3 } } },
  { title: '長照政策發表', text: '提出長照 2.0 加碼方案，銀髮族點頭稱是。', effect: { all: 2, funds: -100 } },
];

// 辯論會策略
export const DEBATE_OPTIONS = [
  { key: 'steady', label: '穩健論述政策', desc: '確定所有選區 +2' },
  { key: 'bold', label: '大膽喊出願景', desc: '55% 機率所有選區 +5；否則 -3' },
  { key: 'attack', label: '猛攻民調領先者', desc: '領先者所有選區 -3，你 +1；30% 機率被反噬 -3' },
];

export const PARTY_PRESETS = [
  { party: '市民新政黨', color: '#ff7043' },
  { party: '藍天聯盟',   color: '#1e88e5' },
  { party: '綠野進步黨', color: '#43a047' },
  { party: '白色力量',   color: '#e0e0e0' },
  { party: '紫色希望',   color: '#8e24aa' },
  { party: '金色未來',   color: '#fbc02d' },
];

export const AI_NAMES = ['王大明', '李美玲', '陳志豪', '林雅婷', '張建國'];

export const RULES = {
  startFunds: 3000,     // 起始競選經費（萬）
  passStartBonus: 400,  // 經過市政府獲得的補助
  baseInfluence: 10,    // 每位候選人在每區的初始聲量
  buyInfluence: 12,     // 設立辦公室獲得的聲量
  upgradeInfluence: 10, // 每次升級的聲量
  maxLevel: 4,
  upgradeCostRatio: 0.6,
  passivePerLevel: 2,   // 每回合每座辦公室自動增加的聲量 × 等級
  counterCostRatio: 0.15, // 停在對手辦公室時的反制文宣費比例 × 等級
  counterLossPerLevel: 4, // 不付反制費時流失的聲量 × 等級
  adCost: 300,          // 投放廣告
  adInfluence: 5,
  mediaCost: 200,
  mediaInfluence: 6,
  turnout: 0.65,        // 投票率
};

export const LEVEL_NAMES = ['', '競選辦公室', '後援會', '造勢晚會', '萬人大造勢'];
