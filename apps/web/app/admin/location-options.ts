// Curated suggestions, not a geocoding service. Custom local names remain editable.
export const regions = ["北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江", "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南", "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州", "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆", "香港", "澳门", "台湾"];
export const cities: Record<string, string[]> = {
  北京: ["北京"], 天津: ["天津"], 上海: ["上海"], 重庆: ["重庆"],
  黑龙江: ["哈尔滨", "齐齐哈尔", "牡丹江", "佳木斯", "大庆", "黑河", "伊春", "大兴安岭"],
  辽宁: ["沈阳", "大连", "鞍山", "丹东", "锦州"], 吉林: ["长春", "吉林", "延吉"],
  甘肃: ["兰州", "张掖", "酒泉", "敦煌", "嘉峪关", "武威", "天水"],
  四川: ["成都", "绵阳", "乐山", "康定", "阿坝"], 云南: ["昆明", "大理", "丽江", "香格里拉"],
  浙江: ["杭州", "宁波", "温州", "绍兴", "嘉兴", "湖州"], 江苏: ["南京", "苏州", "无锡", "扬州"],
  广东: ["广州", "深圳", "珠海", "佛山"], 福建: ["福州", "厦门", "泉州"],
};
export const countries = [
  { code: "CN", zh: "中国", en: "China", timezone: "Asia/Shanghai" },
  { code: "JP", zh: "日本", en: "Japan", timezone: "Asia/Tokyo" },
  { code: "KR", zh: "韩国", en: "South Korea", timezone: "Asia/Seoul" },
  { code: "SG", zh: "新加坡", en: "Singapore", timezone: "Asia/Singapore" },
  { code: "IS", zh: "冰岛", en: "Iceland", timezone: "Atlantic/Reykjavik" },
  { code: "US", zh: "美国", en: "United States", timezone: "" },
  { code: "CA", zh: "加拿大", en: "Canada", timezone: "" },
  { code: "AU", zh: "澳大利亚", en: "Australia", timezone: "" },
];
