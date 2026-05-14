import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');
const dataDir = path.join(root, 'research', 'data');
const archiveDir = path.join(root, 'research', 'archive', 'sources');
const outputPath = path.join(dataDir, 'retractionwatch-china-authors.json');
const sourceCsvPath = path.join(archiveDir, 'retractionwatch.csv');
const sourceUrl = 'https://api.labs.crossref.org/data/retractionwatch';
const targetEntries = Number.parseInt(process.env.RETRACTIONWATCH_TARGET || '1800', 10);

const institutionPatterns = [
  /University/i,
  /College/i,
  /Academy/i,
  /Institute/i,
  /Hospital/i,
  /School/i,
  /Center/i,
  /Centre/i,
  /Laboratory/i,
  /医院/,
  /大学/,
  /学院/,
  /研究院/,
  /研究所/,
  /中心/,
];

const institutionTranslations = new Map([
  ['affiliated cancer hospital & institute of guangzhou medical university', '广州医科大学附属肿瘤医院'],
  ['affiliated hospital of guizhou medical university', '贵州医科大学附属医院'],
  ['affiliated hospital of logistics university of people’s armed police force', '武警后勤学院附属医院'],
  ['affiliated hospital of logistics university of people\'s armed police force', '武警后勤学院附属医院'],
  ['affiliated hospital of nanjing university of chinese medicine', '南京中医药大学附属医院'],
  ['affiliated hospital of shandong university of traditional chinese medicine', '山东中医药大学附属医院'],
  ['affiliated hospital of southwest jiaotong university', '西南交通大学附属医院'],
  ['affiliated hospital of southwest medical university', '西南医科大学附属医院'],
  ['affiliated hospital of qingdao university', '青岛大学附属医院'],
  ['affiliated lishui hospital of zhejiang university/the fifth affiliated hospital of wenzhou medical university/the central hospital of zhejiang lishui', '浙江大学附属丽水医院 / 温州医科大学第五附属医院 / 浙江省丽水市中心医院'],
  ['affiliated rizhao people\'s hospital of jining medical university', '济宁医学院附属日照市人民医院'],
  ['agricultural college of yangzhou university', '扬州大学农学院'],
  ['anhui polytechnic university', '安徽工程大学'],
  ['asia-pacific aesthetic academy', '亚太美容学院'],
  ['baoshan branch of shanghai first people\'s hospital', '上海市第一人民医院宝山分院'],
  ['beijing information science and technology university', '北京信息科技大学'],
  ['beijing institute of economics and management', '北京经济管理职业学院'],
  ['beijing institute of pharmacology and toxicology', '北京药理毒理研究所'],
  ['beijing institute of technology', '北京理工大学'],
  ['beijing normal university', '北京师范大学'],
  ['beijing normal university-hong kong baptist university united international college', '北京师范大学-香港浸会大学联合国际学院'],
  ['beijing open university', '北京开放大学'],
  ['beijing sport university', '北京体育大学'],
  ['beijing university of chinese medicine', '北京中医药大学'],
  ['beijing university of technology', '北京工业大学'],
  ['beijing university ofchinese medicine', '北京中医药大学'],
  ['capital medical university', '首都医科大学'],
  ['capital normal university', '首都师范大学'],
  ['central china normal university', '华中师范大学'],
  ['central hospital affiliated to chongqing university of technology', '重庆理工大学附属中心医院'],
  ['central hospital of panyu district', '番禺区中心医院'],
  ['central south university', '中南大学'],
  ['changchun finance college', '长春金融高等专科学校'],
  ['chengdu institute sichuan international studies university', '四川外国语大学成都学院'],
  ['chengdu second people\'s hospital', '成都市第二人民医院'],
  ['chengdu university of traditional chinese medicine', '成都中医药大学'],
  ['china medical university', '中国医科大学'],
  ['china medical university hospital', '中国医科大学附属医院'],
  ['china medical university hsinchu hospital', '中国医药大学新竹附设医院'],
  ['china pharmaceutical university', '中国药科大学'],
  ['china university of mining and technology', '中国矿业大学'],
  ['chinese pla general hospital/chinese pla medical academy', '中国人民解放军总医院 / 中国人民解放军医学院'],
  ['children\'s hospital of chongqing medical university', '重庆医科大学附属儿童医院'],
  ['children’s hospital of chongqing medical university', '重庆医科大学附属儿童医院'],
  ['children’s hospital of fudan university and national children medical center', '复旦大学附属儿科医院 / 国家儿童医学中心'],
  ['chongqing automotive power system testing engineering technology research center', '重庆汽车动力系统测试工程技术研究中心'],
  ['chongqing city management college', '重庆城市管理职业学院'],
  ['chongqing institute of foreign studies', '重庆外语外事学院'],
  ['chongqing jianzhu college', '重庆建筑工程职业学院'],
  ['chongqing jiaotong university', '重庆交通大学'],
  ['chongqing medical university', '重庆医科大学'],
  ['chongqing technology and business university', '重庆工商大学'],
  ['chongqing university of arts and sciences', '重庆文理学院'],
  ['chongqing university of education', '重庆第二师范学院'],
  ['chongqing university of posts and telecommunications', '重庆邮电大学'],
  ['college of economics and management', '经济管理学院'],
  ['csg digital power grid research institute co.', '南方电网数字电网研究院'],
  ['dalian university of technology key laboratory for ubiquitous network and service software of liaoning province', '大连理工大学辽宁省泛在网络与服务软件重点实验室'],
  ['dongguan university of technology', '东莞理工学院'],
  ['donghua university', '东华大学'],
  ['east china normal university', '华东师范大学'],
  ['eye and ent hospital of fudan university', '复旦大学附属眼耳鼻喉科医院'],
  ['first hospital of jilin university', '吉林大学第一医院'],
  ['first people\'s hospital', '第一人民医院'],
  ['fourth military medical university', '第四军医大学'],
  ['fourth military medical university xi\'an', '西安第四军医大学'],
  ['fudan university', '复旦大学'],
  ['fujian medical university', '福建医科大学'],
  ['fuzhou university of international studies and trade', '福州外语外贸学院'],
  ['guangdong provincial hydroelectric hospital', '广东省水电医院'],
  ['guangdong provincial people’s hospital', '广东省人民医院'],
  ['guangdong provincial people\'s hospital', '广东省人民医院'],
  ['guangdong university of finance and economics', '广东财经大学'],
  ['guangxi medical university', '广西医科大学'],
  ['guangxi normal university', '广西师范大学'],
  ['guangxi science & technology normal university', '广西科技师范学院'],
  ['guangxi university', '广西大学'],
  ['guangxi university of science and technology', '广西科技大学'],
  ['guangzhou dermatology hospital', '广州市皮肤病医院'],
  ['guangzhou university of chinese medicine', '广州中医药大学'],
  ['guizhou normal university', '贵州师范大学'],
  ['guizhou university medical college', '贵州大学医学院'],
  ['hainan university', '海南大学'],
  ['hangzhou normal university', '杭州师范大学'],
  ['hangzhou third people’s hospital', '杭州市第三人民医院'],
  ['hangzhou third people\'s hospital', '杭州市第三人民医院'],
  ['hangzhou women\'s hospital', '杭州市妇产科医院'],
  ['harbin engineering university', '哈尔滨工程大学'],
  ['harbin institute of technology', '哈尔滨工业大学'],
  ['hengyang normal university', '衡阳师范学院'],
  ['henan finance university', '河南财政金融学院'],
  ['henan university of technology', '河南工业大学'],
  ['hohai university', '河海大学'],
  ['hospital for skin diseases', '皮肤病医院'],
  ['hospital of chengdu university of traditional chinese medicine', '成都中医药大学附属医院'],
  ['hubei engineering university', '湖北工程学院'],
  ['hubei university', '湖北大学'],
  ['huazhong agricultural university', '华中农业大学'],
  ['huazhong university of science and technology', '华中科技大学'],
  ['human resources department of affiliated hospital of southwest medical university', '西南医科大学附属医院人力资源部'],
  ['hunan university', '湖南大学'],
  ['hunan university of finance and economics', '湖南财政经济学院'],
  ['hunan university of medicine', '湖南医药学院'],
  ['institute of cotton research', '棉花研究所'],
  ['institute of technology', '理工学院'],
  ['institute of urban rail transit', '城市轨道交通研究院'],
  ['jiande first people’s hospital', '建德市第一人民医院'],
  ['jiande first people\'s hospital', '建德市第一人民医院'],
  ['jiangsu university', '江苏大学'],
  ['jiangsu urban and rural construction college', '江苏城乡建设职业学院'],
  ['jiangxi university of engineering', '江西工程学院'],
  ['jilin university', '吉林大学'],
  ['jinan university', '暨南大学'],
  ['kaohsiung medical university', '高雄医学大学'],
  ['kunming university of science and technology', '昆明理工大学'],
  ['laboratory of cardiovascular physiology', '心血管生理实验室'],
  ['lanzhou university', '兰州大学'],
  ['liaoning technical university', '辽宁工程技术大学'],
  ['liaoning university', '辽宁大学'],
  ['linyi city people\'s hospital', '临沂市人民医院'],
  ['linyi university', '临沂大学'],
  ['longgang district maternity & child healthcare hospital of shenzhen city (longgang maternity and child institute of shantou university medical college)', '深圳市龙岗区妇幼保健院（汕头大学医学院龙岗妇幼研究所）'],
  ['medical supplies center of pla general hospital', '解放军总医院医学保障中心'],
  ['military postgraduate medical college', '军医进修学院'],
  ['mudanjiang medical college', '牡丹江医学院'],
  ['nanfang hospital of southern medical university', '南方医科大学南方医院'],
  ['nanjing agricultural university', '南京农业大学'],
  ['nanjing audit university jinshen college', '南京审计大学金审学院'],
  ['nanjing forestry university', '南京林业大学'],
  ['nanjing medical university', '南京医科大学'],
  ['nanjing medical university nanjing', '南京医科大学'],
  ['nanjing tech university', '南京工业大学'],
  ['nanjing university', '南京大学'],
  ['nanjing university of aeronautics and astronautics', '南京航空航天大学'],
  ['nanjing university of information science and technology', '南京信息工程大学'],
  ['nanjing vocational university of industry technology', '南京工业职业技术大学'],
  ['national cancer center/national clinical research center for cancer/cancer hospital', '国家癌症中心 / 国家肿瘤临床医学研究中心 / 中国医学科学院肿瘤医院'],
  ['national cheng kung university', '成功大学'],
  ['naval medical university', '海军军医大学'],
  ['ningbo university', '宁波大学'],
  ['northeast normal university', '东北师范大学'],
  ['northwest a&f university', '西北农林科技大学'],
  ['northwestern polytechnical university', '西北工业大学'],
  ['ocean university of china', '中国海洋大学'],
  ['peking union medical college hospital', '北京协和医院'],
  ['peking university', '北京大学'],
  ['peking university people\'s hospital', '北京大学人民医院'],
  ['peking university shenzhen', '北京大学深圳研究生院'],
  ['peking university shenzhen hospital', '北京大学深圳医院'],
  ['peking university teaching hospital', '北京大学教学医院'],
  ['pla university of science and technology', '解放军理工大学'],
  ['plastic surgery hospital', '整形外科医院'],
  ['qilu university of technology (shandong academy of sciences)', '齐鲁工业大学（山东省科学院）'],
  ['qingdao university', '青岛大学'],
  ['ren min hospital of wuhan university', '武汉大学人民医院'],
  ['renmin hospital of wuhan university', '武汉大学人民医院'],
  ['rui jin hospital affiliated with shanghai jiaotong university', '上海交通大学医学院附属瑞金医院'],
  ['saarland university', '萨尔兰大学'],
  ['sanjiang university', '三江学院'],
  ['shaanxi normal university', '陕西师范大学'],
  ['shandong provincial hospital affiliated to shandong university', '山东大学附属省立医院'],
  ['shandong research institute of industrial technology', '山东产业技术研究院'],
  ['shandong university', '山东大学'],
  ['shangluo university', '商洛学院'],
  ['shanghai china-norm quality technical service co.', '上海中规质量技术服务有限公司'],
  ['shanghai jiao tong university', '上海交通大学'],
  ['shanghai jiao tong university affiliated sixth people’s hospital', '上海交通大学附属第六人民医院'],
  ['shanghai jiao tong university affiliated sixth people\'s hospital', '上海交通大学附属第六人民医院'],
  ['shanghai jiao tong university school of medicine', '上海交通大学医学院'],
  ['shanghai jiaotong university', '上海交通大学'],
  ['shanghai normal university', '上海师范大学'],
  ['shanghai normal university tianhua college', '上海师范大学天华学院'],
  ['shanghai pudong new area gongli hospital', '上海市浦东新区公利医院'],
  ['shanghai university', '上海大学'],
  ['shanghai university of traditional chinese medicine', '上海中医药大学'],
  ['shanghai veterinary research institute', '上海兽医研究所'],
  ['shenzhen second people’s hospital. the first affiliated hospital of shenzhen university', '深圳市第二人民医院 / 深圳大学第一附属医院'],
  ['shenzhen second people\'s hospital. the first affiliated hospital of shenzhen university', '深圳市第二人民医院 / 深圳大学第一附属医院'],
  ['shenzhen university', '深圳大学'],
  ['shenzhen university medical school', '深圳大学医学部'],
  ['shenzhen university of information technology', '深圳信息职业技术学院'],
  ['shidong hospital affiliated to university of shanghai for science and technology', '上海理工大学附属市东医院'],
  ['shuguang hospital shanghai university of traditional chinese medicine', '上海中医药大学附属曙光医院'],
  ['sichuan provincial people\'s hospital', '四川省人民医院'],
  ['sichuan university', '四川大学'],
  ['sichuan university west china hospital', '四川大学华西医院'],
  ['soochow university', '苏州大学'],
  ['southeast university', '东南大学'],
  ['southern medical university', '南方医科大学'],
  ['southwest jiaotong university', '西南交通大学'],
  ['southwest medical university', '西南医科大学'],
  ['southwest university', '西南大学'],
  ['southwestern university of financial and economics', '西南财经大学'],
  ['state grid tianjin construction company', '国网天津建设公司'],
  ['state key laboratory of traditional chinese medicine syndrome/the second clinical college of guangzhou university of chinese medicine', '中医证候全国重点实验室 / 广州中医药大学第二临床医学院'],
  ['sun yat-sen university', '中山大学'],
  ['sun yat-sen university cancer center', '中山大学肿瘤防治中心'],
  ['suzhou university', '苏州大学'],
  ['taihe hospital of hubei province', '湖北省太和医院'],
  ['technology internet department', '技术互联网部门'],
  ['the 2nd affiliated hospital of harbin medical university', '哈尔滨医科大学第二附属医院'],
  ['the affiliated drum tower hospital of nanjing university medical school', '南京大学医学院附属鼓楼医院'],
  ['the affiliated hospital of guizhou medical university', '贵州医科大学附属医院'],
  ['the affiliated hospital of qingdao university', '青岛大学附属医院'],
  ['the affiliated hospital of southwest medical university', '西南医科大学附属医院'],
  ['the affiliated huaian no.1 people’s hospital of nanjingmedical university', '南京医科大学附属淮安第一人民医院'],
  ['the affiliated huaian no.1 people\'s hospital of nanjingmedical university', '南京医科大学附属淮安第一人民医院'],
  ['the affiliated sir run run hospital of nanjing medical university', '南京医科大学附属逸夫医院'],
  ['the chinese university of hong kong', '香港中文大学'],
  ['the first affiliated hospital of chongqing medical university', '重庆医科大学第一附属医院'],
  ['the first affiliated hospital of nanjing medical university', '南京医科大学第一附属医院'],
  ['the first affiliated hospital of shenzhen university', '深圳大学第一附属医院'],
  ['the first affiliated hospital of soochow university', '苏州大学附属第一医院'],
  ['the first affiliated hospital of xi’an jiaotong university', '西安交通大学第一附属医院'],
  ['the first affiliated hospital of xi\'an jiaotong university', '西安交通大学第一附属医院'],
  ['the first affiliated hospital of zhengzhou university', '郑州大学第一附属医院'],
  ['the first hospital of hunan university of chinese medicine', '湖南中医药大学第一附属医院'],
  ['the general hospital of the central military theater of the people\'s liberation army', '中国人民解放军中部战区总医院'],
  ['the second affiliated hospital of anhui medical university', '安徽医科大学第二附属医院'],
  ['the second affiliated hospital of zhejiang university', '浙江大学第二附属医院'],
  ['the second clinical medical college of jinan university', '暨南大学第二临床医学院'],
  ['the second clinical school of yangzhou university', '扬州大学第二临床医学院'],
  ['the second military medical university', '第二军医大学'],
  ['the sixth affiliated hospital of guangzhou medical university', '广州医科大学第六附属医院'],
  ['the third affiliated hospital of guangzhou medical university', '广州医科大学第三附属医院'],
  ['the third affiliated hospital of soochow university', '苏州大学附属第三医院'],
  ['tianjin children’s hospital', '天津市儿童医院'],
  ['tianjin children\'s hospital', '天津市儿童医院'],
  ['tianjin first center hospital', '天津市第一中心医院'],
  ['tianjin medical university general hospital/ tianjin institute of sexually transmitted disease', '天津医科大学总医院 / 天津市性传播疾病研究所'],
  ['tianjin university', '天津大学'],
  ['tianjin university of sport', '天津体育学院'],
  ['tianjin university of traditional chinese medicine', '天津中医药大学'],
  ['tongji university', '同济大学'],
  ['tsinghua university', '清华大学'],
  ['university hong kong', '香港大学'],
  ['university of chinese academy of sciences', '中国科学院大学'],
  ['university of electronic science and technology of china', '电子科技大学'],
  ['university of science and technology of china', '中国科学技术大学'],
  ['wangjing hospital', '望京医院'],
  ['wenzhou medical university', '温州医科大学'],
  ['wenzhou university', '温州大学'],
  ['wenzhou-kean university', '温州肯恩大学'],
  ['wuhan city college', '武汉城市学院'],
  ['wuhan university', '武汉大学'],
  ['wuhan university of technology', '武汉理工大学'],
  ['xiamen university', '厦门大学'],
  ['xiangtan university', '湘潭大学'],
  ['xiangya hospital of central south university', '中南大学湘雅医院'],
  ['xian jiaotong university health science center', '西安交通大学医学部'],
  ['xi\'an jiaotong university health science center', '西安交通大学医学部'],
  ['xiaoshan chinese medical hospital', '萧山区中医院'],
  ['xinhua hospital affiliated to shanghai jiao tong university school of medicine', '上海交通大学医学院附属新华医院'],
  ['xinyang vocational and technical college', '信阳职业技术学院'],
  ['yanbian university hospital', '延边大学附属医院'],
  ['yangzhou university', '扬州大学'],
  ['yellow river institute of hydraulic research', '黄河水利科学研究院'],
  ['yiwu central hospital', '义乌市中心医院'],
  ['yunnan normal university', '云南师范大学'],
  ['yunnan university', '云南大学'],
  ['yunsheng science and technology park', '云升科技园'],
  ['chinese pla general hospital/chinese pla medical academy', '中国人民解放军总医院 / 中国人民解放军医学院'],
  ['national cancer center/national clinical research center for cancer/cancer hospital', '国家癌症中心 / 国家肿瘤临床医学研究中心 / 中国医学科学院肿瘤医院'],
  ['school of artificial intelligence', '人工智能学院'],
  ['school of foreign languages & international business', '外国语与国际商务学院'],
  ['school of information technology', '信息技术学院'],
  ['school of international education south china university of technology guangzhou guangdong china', '华南理工大学国际教育学院'],
  ['second hospital of tianjin medical university', '天津医科大学第二医院'],
  ['second military medical university', '第二军医大学'],
  ['state key laboratory of traditional chinese medicine syndrome/the second clinical college of guangzhou university of chinese medicine', '中医证候全国重点实验室 / 广州中医药大学第二临床医学院'],
  ['tianjin medical university general hospital/ tianjin institute of sexually transmitted disease', '天津医科大学总医院 / 天津市性传播疾病研究所'],
  ['zhejiang a&f university', '浙江农林大学'],
  ['zhejiang chinese medical university', '浙江中医药大学'],
  ['zhejiang institute of communications', '浙江交通职业技术学院'],
  ['zhejiang normal university', '浙江师范大学'],
  ['zhejiang university', '浙江大学'],
  ['zhejiang university of science and technology', '浙江科技大学'],
  ['zhejiang university of technology', '浙江工业大学'],
  ['zhaoqing university', '肇庆学院'],
  ['zhengzhou university', '郑州大学'],
  ['zhengzhou university of technology', '郑州工业应用技术学院'],
  ['zunyi medical university', '遵义医科大学'],
]);

const placeTranslations = new Map([
  ['Anhui', '安徽'],
  ['Beijing', '北京'],
  ['Capital', '首都'],
  ['Central China', '华中'],
  ['Central South', '中南'],
  ['Chengdu', '成都'],
  ['China', '中国'],
  ['Chongqing', '重庆'],
  ['Dalian', '大连'],
  ['Dongguan', '东莞'],
  ['East China', '华东'],
  ['Fujian', '福建'],
  ['Guangdong', '广东'],
  ['Guangxi', '广西'],
  ['Guangzhou', '广州'],
  ['Guizhou', '贵州'],
  ['Hainan', '海南'],
  ['Hangzhou', '杭州'],
  ['Harbin', '哈尔滨'],
  ['Henan', '河南'],
  ['Hohai', '河海'],
  ['Hubei', '湖北'],
  ['Hunan', '湖南'],
  ['Huazhong', '华中'],
  ['Jiangsu', '江苏'],
  ['Jilin', '吉林'],
  ['Jinan', '暨南'],
  ['Lanzhou', '兰州'],
  ['Liaoning', '辽宁'],
  ['Nanjing', '南京'],
  ['Ningbo', '宁波'],
  ['Northeast', '东北'],
  ['Northwest', '西北'],
  ['Northwestern', '西北'],
  ['Ocean', '海洋'],
  ['Peking', '北京'],
  ['Qingdao', '青岛'],
  ['Shandong', '山东'],
  ['Shanghai', '上海'],
  ['Shenzhen', '深圳'],
  ['Sichuan', '四川'],
  ['South China', '华南'],
  ['Southern', '南方'],
  ['Southwest', '西南'],
  ['Southeast', '东南'],
  ['Sun Yat-sen', '中山'],
  ['Suzhou', '苏州'],
  ['Taihe', '太和'],
  ['Tianjin', '天津'],
  ['Tongji', '同济'],
  ['Wenzhou', '温州'],
  ['Wuhan', '武汉'],
  ['Xi\'an Jiaotong', '西安交通'],
  ['Xi’an Jiaotong', '西安交通'],
  ['Xiamen', '厦门'],
  ['Yangzhou', '扬州'],
  ['Yunnan', '云南'],
  ['Zhejiang', '浙江'],
  ['Zhengzhou', '郑州'],
]);

const natureTranslations = new Map([
  ['Retraction', '撤稿'],
  ['Correction', '更正'],
  ['Expression of concern', '关注声明'],
  ['Expression of Concern', '关注声明'],
  ['Withdrawal', '撤回'],
  ['Retraction Watch 数据库记录', '撤稿数据库记录'],
]);

const reasonTranslations = new Map([
  ['Article Duplication', '论文重复发表'],
  ['Author Unresponsive', '作者未回应'],
  ['Cites Retracted Work', '引用已撤稿文献'],
  ['Compromised Peer Review', '同行评议受损'],
  ['Computer-Aided Content or Computer-Generated Content', '计算机辅助或生成内容问题'],
  ['Concerns/Issues about Animal Welfare', '动物福利问题'],
  ['Concerns/Issues about Article', '论文本身存在问题'],
  ['Concerns/Issues about Authorship/Affiliation', '作者或机构署名问题'],
  ['Concerns/Issues about Data', '数据问题'],
  ['Concerns/Issues about Human Subject Welfare', '人体研究伦理问题'],
  ['Concerns/Issues about Image', '图片问题'],
  ['Concerns/Issues about Methods', '研究方法问题'],
  ['Concerns/Issues about Peer Review', '同行评议问题'],
  ['Concerns/Issues about Referencing/Attributions', '引用或归属问题'],
  ['Concerns/Issues about Results and/or Conclusions', '结果或结论问题'],
  ['Conflict of Interest', '利益冲突'],
  ['Contamination of Cell Lines/Tissues', '细胞系或组织样本污染'],
  ['Date of Article and/or Notice Unknown', '论文或通知日期不明'],
  ['Duplication of Data', '数据重复'],
  ['Duplication of/in Article', '论文内容重复'],
  ['Duplication of/in Image', '图片重复'],
  ['Error by Journal/Publisher', '期刊或出版方错误'],
  ['Error in Analyses', '分析错误'],
  ['Error in Cell Lines/Tissues', '细胞系或组织样本错误'],
  ['Error in Data', '数据错误'],
  ['Error in Image', '图片错误'],
  ['Error in Materials', '材料错误'],
  ['Error in Text', '文本错误'],
  ['Euphemisms for Duplication', '重复问题的委婉表述'],
  ['Euphemisms for Plagiarism', '抄袭问题的委婉表述'],
  ['False/Forged Affiliation', '机构信息虚假或伪造'],
  ['False/Forged Authorship', '作者信息虚假或伪造'],
  ['Falsification/Fabrication of Data', '数据篡改或伪造'],
  ['Investigation by Company/Institution', '公司或机构调查'],
  ['Investigation by Journal/Publisher', '期刊或出版方调查'],
  ['Investigation by Third Party', '第三方调查'],
  ['Lack of Approval from Author', '缺少作者批准'],
  ['Lack of Approval from Third Party', '缺少第三方批准'],
  ['Lack of IRB/IACUC Approval and/or Compliance', '伦理审查批准或合规问题'],
  ['Manipulation of Data', '数据操纵'],
  ['Manipulation of Images', '图片操纵'],
  ['Misconduct - Official Investigation(s) and/or Finding(s)', '官方调查认定存在不端'],
  ['Misconduct by Author', '作者不端'],
  ['Misconduct by Third Party', '第三方不端'],
  ['Notice - Limited or No Information', '通知信息有限'],
  ['Objections by Author(s)', '作者异议'],
  ['Original Data and/or Images not Provided and/or not Available', '原始数据或图片未提供或无法取得'],
  ['Plagiarism of Data', '数据抄袭'],
  ['Plagiarism of Image', '图片抄袭'],
  ['Plagiarism of Text', '文本抄袭'],
  ['Plagiarism of/in Article', '论文抄袭'],
  ['Removed', '记录移除'],
  ['Results Not Reproducible', '结果无法复现'],
  ['Retract and Replace', '撤稿并替换'],
  ['Rogue Editor', '编辑流程异常'],
  ['Taken from Dissertation/Thesis', '取自学位论文'],
  ['Unreliable Data', '数据可靠性存疑'],
  ['Unreliable Results and/or Conclusions', '结果或结论可靠性存疑'],
  ['Updated to Retraction', '已更新为撤稿'],
  ['Upgrade/Update of Prior Notice(s)', '既有通知升级或更新'],
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function recordsFromCsv(text) {
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim()));
  const headers = rows.shift();
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function compactTitle(value, max = 120) {
  const text = clean(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function normalizeDate(value) {
  const text = clean(value).split(' ')[0];
  const monthDayYear = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (monthDayYear) {
    const [, month, day, year] = monthDayYear;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return text;
}

function splitList(value) {
  return clean(value)
    .split(';')
    .map((item) => clean(item))
    .filter(Boolean);
}

function normalizeInstitutionKey(value) {
  return clean(value)
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function knownInstitutionName(value) {
  const key = normalizeInstitutionKey(value);
  if (institutionTranslations.has(key)) return institutionTranslations.get(key);

  let best = null;
  for (const [candidate, translation] of institutionTranslations) {
    if (key.includes(candidate) && (!best || candidate.length > best.candidate.length)) {
      best = { candidate, translation };
    }
  }
  return best?.translation || '';
}

function translateLeadingPlace(value) {
  for (const [english, chinese] of [...placeTranslations.entries()].sort((a, b) => b[0].length - a[0].length)) {
    if (new RegExp(`^${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(value)) {
      return value.replace(new RegExp(`^${english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), chinese);
    }
  }
  return value;
}

function translateInstitutionFallback(value) {
  const text = clean(value).replace(/[’‘]/g, "'");
  let match = text.match(/^The\s+(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth)\s+Affiliated Hospital of\s+(.+)$/i);
  if (match) {
    const ordinal = {
      First: '第一',
      Second: '第二',
      Third: '第三',
      Fourth: '第四',
      Fifth: '第五',
      Sixth: '第六',
      Seventh: '第七',
      Eighth: '第八',
    }[match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()] || '';
    return `${translateInstitutionName(match[2])}${ordinal}附属医院`;
  }

  match = text.match(/^Affiliated\s+(.+?)\s+Hospital of\s+(.+)$/i);
  if (match) return `${translateInstitutionName(match[2])}附属${translateInstitutionName(`${match[1]} Hospital`)}`;

  match = text.match(/^(.+?)\s+Hospital Affiliated to\s+(.+)$/i);
  if (match) return `${translateInstitutionName(match[2])}附属${translateInstitutionName(`${match[1]} Hospital`)}`;

  match = text.match(/^(.+?)\s+Hospital of\s+(.+)$/i);
  if (match) return `${translateInstitutionName(match[2])}${translateInstitutionName(`${match[1]} Hospital`)}`;

  match = text.match(/^(.+?)\s+University of Traditional Chinese Medicine$/i);
  if (match) return `${translateLeadingPlace(match[1])}中医药大学`;

  match = text.match(/^(.+?)\s+Medical University$/i);
  if (match) return `${translateLeadingPlace(match[1])}医科大学`;

  match = text.match(/^(.+?)\s+Normal University$/i);
  if (match) return `${translateLeadingPlace(match[1])}师范大学`;

  match = text.match(/^(.+?)\s+Agricultural University$/i);
  if (match) return `${translateLeadingPlace(match[1])}农业大学`;

  match = text.match(/^(.+?)\s+Forestry University$/i);
  if (match) return `${translateLeadingPlace(match[1])}林业大学`;

  match = text.match(/^(.+?)\s+University of Science and Technology$/i);
  if (match) return `${translateLeadingPlace(match[1])}科技大学`;

  match = text.match(/^(.+?)\s+University of Technology$/i);
  if (match) return `${translateLeadingPlace(match[1])}理工大学`;

  match = text.match(/^(.+?)\s+University$/i);
  if (match) return `${translateLeadingPlace(match[1])}大学`;

  match = text.match(/^(.+?)\s+College$/i);
  if (match) return `${translateLeadingPlace(match[1])}学院`;

  return translateLeadingPlace(text)
    .replace(/\bUniversity\b/gi, '大学')
    .replace(/\bCollege\b/gi, '学院')
    .replace(/\bAcademy\b/gi, '学院')
    .replace(/\bInstitute\b/gi, '研究院')
    .replace(/\bHospital\b/gi, '医院')
    .replace(/\bSchool\b/gi, '学院')
    .replace(/\bCenter\b/gi, '中心')
    .replace(/\bCentre\b/gi, '中心')
    .replace(/\bLaboratory\b/gi, '实验室')
    .replace(/\bMedical\b/gi, '医学')
    .replace(/\bTechnology\b/gi, '技术')
    .replace(/\bScience\b/gi, '科学')
    .replace(/\bTraditional Chinese Medicine\b/gi, '中医药')
    .replace(/\bPeople'?s\b/gi, '人民')
    .replace(/\bAffiliated\b/gi, '附属')
    .replace(/\bThe\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function translateInstitutionName(value) {
  const text = clean(value);
  if (!text) return '中国高校/科研机构（数据库记录）';
  if (!/[A-Za-z]/.test(text)) return text;

  const known = knownInstitutionName(text);
  if (known) return known;

  if (text.includes('/')) {
    return text
      .split('/')
      .map((part) => translateInstitutionName(part))
      .filter(Boolean)
      .join(' / ');
  }

  return translateInstitutionFallback(text) || text;
}

function translateNature(value) {
  const text = clean(value);
  if (!text) return '撤稿数据库记录';
  for (const [english, chinese] of natureTranslations) {
    if (english.toLowerCase() === text.toLowerCase()) return chinese;
  }
  return text;
}

function translateReasonList(value) {
  const reasons = splitList(value);
  if (!reasons.length) return '';

  return reasons
    .map((reason) => reasonTranslations.get(reason) || reason)
    .filter(Boolean)
    .join('；');
}

function isChinaRelated(record) {
  const joined = `${record.Country} ${record.Institution}`;
  return /(^|;)China(;|$)|People's Republic of China|Hong Kong|Macau|Taiwan|中国|Beijing|Shanghai|Guangzhou|Shenzhen|Wuhan|Nanjing|Hangzhou|Chengdu|Xi'an|Tianjin|Chongqing/i.test(joined);
}

function pickInstitution(record) {
  const institutions = splitList(record.Institution);
  const chinaInstitutions = institutions.filter((item) =>
    /China|People's Republic of China|Hong Kong|Macau|Taiwan|中国|Beijing|Shanghai|Guangzhou|Shenzhen|Wuhan|Nanjing|Hangzhou|Chengdu|Xi'an|Tianjin|Chongqing/i.test(item),
  );
  const pool = chinaInstitutions.length ? chinaInstitutions : institutions;
  return pool.find((item) => institutionPatterns.some((pattern) => pattern.test(item))) || pool[0] || '中国高校/科研机构（数据库记录）';
}

function institutionDisplayName(institution) {
  const text = clean(institution)
    .replace(/\b\d{5,6}\b/g, '')
    .replace(/\s*,\s*,/g, ',')
    .replace(/\s+;/g, ';')
    .trim();
  const parts = text
    .split(',')
    .map((part) => clean(part))
    .filter((part) => part && !/^(People's Republic of China|China|P\.R\. China|PR China)$/i.test(part));
  const schoolLike =
    parts.find((part) => /University|大学/i.test(part)) ||
    parts.find((part) => /Academy|Institute|Hospital|College|研究院|研究所|医院|学院/i.test(part)) ||
    parts.find((part) => institutionPatterns.some((pattern) => pattern.test(part)));
  return translateInstitutionName(schoolLike || parts[0] || text || '中国高校/科研机构（数据库记录）');
}

function sourceMarkdown(record) {
  const links = [];
  if (record.RetractionDOI && record.RetractionDOI !== 'unavailable') {
    links.push(`[撤稿/更正 DOI](https://doi.org/${record.RetractionDOI})`);
  }
  if (record.OriginalPaperDOI && record.OriginalPaperDOI !== 'unavailable') {
    links.push(`[原论文 DOI](https://doi.org/${record.OriginalPaperDOI})`);
  }
  if (record.URLS) {
    for (const [index, url] of splitList(record.URLS).slice(0, 2).entries()) {
      links.push(`[撤稿观察线索 ${index + 1}](${url})`);
    }
  }
  links.push(`[开放撤稿数据库](${sourceUrl})`);
  return links.join('；');
}

function recordToEntries(record) {
  const authors = splitList(record.Author).slice(0, 8);
  if (!authors.length) return [];

  const institution = pickInstitution(record);
  const school = institutionDisplayName(institution);
  const institutionForDisplay = translateInstitutionName(institution);
  const title = compactTitle(record.Title);
  const reason = translateReasonList(record.Reason);
  const nature = translateNature(record.RetractionNature);
  const eventName = `论文${nature}记录（原题名见详情）`;
  const date = normalizeDate(record.RetractionDate);
  const articleType = clean(record.ArticleType);
  const journal = clean(record.Journal);
  const sourceRecordId = record['Record ID'];
  const authorCount = authors.length;
  const displayName = sourceRecordId ? `撤稿记录${sourceRecordId}作者组` : '撤稿记录作者组';

  const summary = `开放撤稿数据库记录显示，论文《${title}》于 ${date || '日期待核'} 在 ${journal || '期刊待核'} 形成${nature}记录；数据库列出的原因包括：${reason || '未列明'}。该条目按论文与机构字段归集，用于呈现公开数据库中的科研诚信风险线索。`;
  const contextNarrative = `${displayName}来自开放撤稿数据库的同一篇论文记录，数据库作者字段共列出 ${authorCount} 人，机构字段归一为${school}。记录链条为：论文发表后，数据库收录了与该论文相关的${nature}信息；记录日期为${date || '待核'}，期刊为${journal || '待核'}，原因字段包括${reason || '未列明'}，原论文题名为《${title}》。事实边界限定在论文记录、作者字段和机构字段。`;

  return [{
    name: displayName,
    displayName,
    school,
    identity: `${school}关联作者组；开放撤稿数据库作者字段计 ${authorCount} 人；机构字段归一：${institutionForDisplay}`,
    year: date,
    eventName,
    summary,
    contextNarrative,
    impact: '撤稿数据库记录可用于观察高校科研诚信风险、论文发表规范和机构关联情况；本条仅呈现公开数据库中的作者与机构关联线索。',
    nature: `论文记录：${nature}`,
    sourcesMarkdown: sourceMarkdown(record),
    photoMarkdown: '无可列',
    paperMarkdown: record.OriginalPaperDOI && record.OriginalPaperDOI !== 'unavailable'
      ? `[原论文：${title}](https://doi.org/${record.OriginalPaperDOI})`
      : `论文题名：${title}`,
    section: '批量扩展：中国高校/科研机构撤稿数据库关联记录',
    subsection: school,
    credibility: '需核验',
    sourceRecordId,
    sourceDataset: '开放撤稿数据库',
    sourceAuthorCount: authorCount,
    factBoundary: '论文撤稿/更正数据库记录；个人责任认定以权威结论为准',
    articleType,
  }];
}

function uniqueEntries(entries) {
  const seen = new Set();
  const result = [];
  for (const entry of entries) {
    const sourceKey = entry.sourceRecordId || entry.paperMarkdown || entry.eventName;
    const key = `${entry.school}|${sourceKey}|${entry.nature}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

function main() {
  if (!fs.existsSync(sourceCsvPath)) {
    throw new Error(`Missing ${sourceCsvPath}. Download it with: curl.exe -L -o "${sourceCsvPath}" ${sourceUrl}`);
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const records = recordsFromCsv(fs.readFileSync(sourceCsvPath, 'utf8'));
  const sampled = [];
  let sampledAuthorRows = 0;

  for (const record of records.filter(isChinaRelated)) {
    if (sampledAuthorRows >= targetEntries) break;
    const rows = recordToEntries(record);
    if (!rows.length) continue;
    sampled.push(...rows);
    sampledAuthorRows += splitList(record.Author).slice(0, 8).length;
  }

  const entries = uniqueEntries(sampled);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: sourceUrl,
    sampledAuthorRows,
    factBoundary: '开放撤稿数据库中的论文撤稿或更正记录；按论文记录与机构字段归并展示，个人责任认定以权威结论为准。',
    entries,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${entries.length} entries to ${outputPath}`);
}

main();
