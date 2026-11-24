/**
 * ============================================================================
 * 康軒音樂｜流行音樂開麥拉 學習單 Google Apps Script 後端程式碼 (v2.2 正式無瑕版)
 * ============================================================================
 * 
 * 🛠️ 本次核心關鍵修復：
 * 1. 【修復 setAlignment API 錯誤】：
 *    - Google Apps Script 正確語法為 setHorizontalAlignment('center')。
 *    - 先前因 setAlignment 導致在建立第 1 個大題群組（學生基本資料）後引發 TypeError，
 *      造成後續各大題表頭中斷、學生作答無法寫入第 3 列。現已全面修正為 setHorizontalAlignment！
 * 2. 【雙層結構完整繪製】：
 *    - 完整呈現 6 大題群組色彩合併標題，絕不中斷。
 * 3. 【精確定位第 3 列寫入】：
 *    - 確保第 1 筆作答 100% 精準寫在第 3 列，絕不漂移到第 1001 列。
 * 4. 【排序與公式連動保護】：
 *    - 累積 2 筆以上才依座號排序，保護單筆作答。
 *    - 總分以試算表公式自動加總，並支援教師手動覆寫。
 */

// 選擇題標準答案
const QUIZ_ANSWER_KEYS = {
  q1: 'C', // 蘇打綠
  q2: 'A', // 〈島嶼天光〉
  q3: 'C', // 舒米恩．魯碧
  q4: 'B', // 謝金燕
  q5: 'D'  // 荒山亮
};

// 星馬歌手辭庫
const SINGER_KNOWLEDGE_BASE = {
  singapore: [
    '孫燕姿', '林俊傑', 'JJ', 'JJ LIN', '蔡健雅', '阿杜', '陳潔儀', 
    '黃義達', 'OLIVIA ONG', '文慧如', '邱鋒澤', '董姿彥', '陳偉聯'
  ],
  malaysia: [
    '梁靜茹', '光良', '品冠', '無印良品', '戴佩妮', '黃明志', '張棟樑', 
    '陳勢安', '曹格', '李佳薇', '李心潔', '阿牛', '陳慶祥', '宇珩', 
    '方泂鑌', '張智成', '巫啟賢', '柯以敏', '張與辰'
  ],
  nonSingMa: [
    '周杰倫', '蔡依林', '五月天', '張惠妹', 'A-MEI', '蕭敬騰', '羅志祥', 
    '江蕙', '謝金燕', '蘇打綠', '滅火器', '草東沒有派對', '茄子蛋', 
    '林生祥', '蕭煌奇', '鄧紫棋', '陳奕迅', '王力宏', '陶喆', '告五人', '理想混蛋'
  ]
};

// 雙層表頭定義 (共 25 欄)
const HEADER_GROUPS = [
  { title: '學生基本資料', span: 3, bg: '#1e3a8a', color: '#ffffff' },          // 1~3
  { title: '一、牛刀小試 (選擇題作答結果)', span: 5, bg: '#3730a3', color: '#ffffff' }, // 4~8
  { title: '二、星馬歌手 (主觀題作答結果)', span: 6, bg: '#065f46', color: '#ffffff' }, // 9~14
  { title: '三、如果我是歌手 (社會關懷想法)', span: 2, bg: '#9a3412', color: '#ffffff' }, // 15~16
  { title: '【綜合評分專區】(依教師評分標準)', span: 8, bg: '#78350f', color: '#ffffff' }, // 17~24
  { title: '提交資訊', span: 1, bg: '#475569', color: '#ffffff' }               // 25
];

const SUB_HEADERS = [
  // 學生基本資料 (1~3)
  '班級', '座號', '姓名',
  // 一、牛刀小試 (4~8)
  'Q1 答案', 'Q2 答案', 'Q3 答案', 'Q4 答案', 'Q5 答案',
  // 二、星馬歌手 (9~14)
  '組1 歌手', '組1 代表作品', '組1 喜歡原因',
  '組2 歌手', '組2 代表作品', '組2 喜歡原因',
  // 三、如果我是歌手 (15~16)
  '想表達的社會議題', '創作理念與原因闡述',
  // 【綜合評分專區】(17~24)
  '第一大題得分\n(滿分50)',
  '第二大題得分\n(滿分25)',
  '第三大題得分\n(滿分25)',
  '【綜合總分】\n(滿分100)',
  '【表現等級】\n(精熟/基礎/待加強)',
  '第二大題評語診斷',
  '第三大題評語診斷',
  '教師手動調整總分\n(選填)',
  // 提交資訊 (25)
  '填寫時間'
];

/**
 * 試算表開啟時建立選單
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🎵 流行音樂開麥拉')
    .addItem('🔄 重新美化與整理所有分頁', 'reformatAllSheets')
    .addItem('🚑 檢查並修復未顯示的作答資料', 'rescueDisplacedData')
    .addToUi();
}

/**
 * GET 測試
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    version: '2.2',
    message: '康軒音樂「流行音樂開麥拉」評分系統後端運作正常！',
    time: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * POST 請求：接收學生作答並精確存入
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    } else {
      throw new Error('未接收到有效資料');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. 執行評分計算
    const evalResult = executeAutoGrading(data);

    // 2. 存入「該班級獨立分頁」（確保表頭完整繪製，第 1 筆在第 3 列）
    const classSheetName = String(data.classCode).trim();
    const classSheet = getOrCreateSheet(ss, classSheetName);
    insertStudentRecord(classSheet, evalResult);
    sortSheetBySeatNumber(classSheet);

    // 3. 存入「全校作答總表」
    const summarySheet = getOrCreateSheet(ss, '全校作答總表');
    insertStudentRecord(summarySheet, evalResult);

    // 清理無效空工作表
    cleanDefaultSheet(ss);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: `已成功存入【${classSheetName}】分頁與全校總表！`,
      classCode: classSheetName,
      seatNo: evalResult.seatNo,
      studentName: evalResult.studentName,
      totalScore: evalResult.totalScore
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

/**
 * 自動評分計算
 */
function executeAutoGrading(d) {
  const timestamp = d.timestamp || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  const classCode = String(d.classCode || '').trim();
  const seatNo = String(d.seatNo || '').padStart(2, '0');
  const studentName = String(d.studentName || '').trim();

  // 第一大題：選擇題（每題10分，共50分）
  const q1 = String(d.q1 || '').toUpperCase();
  const q2 = String(d.q2 || '').toUpperCase();
  const q3 = String(d.q3 || '').toUpperCase();
  const q4 = String(d.q4 || '').toUpperCase();
  const q5 = String(d.q5 || '').toUpperCase();

  const q1Score = (q1 === QUIZ_ANSWER_KEYS.q1) ? 10 : 0;
  const q2Score = (q2 === QUIZ_ANSWER_KEYS.q2) ? 10 : 0;
  const q3Score = (q3 === QUIZ_ANSWER_KEYS.q3) ? 10 : 0;
  const q4Score = (q4 === QUIZ_ANSWER_KEYS.q4) ? 10 : 0;
  const q5Score = (q5 === QUIZ_ANSWER_KEYS.q5) ? 10 : 0;
  const part1Score = q1Score + q2Score + q3Score + q4Score + q5Score;

  // 第二大題：星馬歌手
  const s1 = gradeSingleSinger(d.singer1Name, d.singer1Song, d.singer1Reason);
  const s2 = gradeSingleSinger(d.singer2Name, d.singer2Song, d.singer2Reason);
  const part2Score = Math.min(25, Number((s1.score + s2.score).toFixed(1)));
  const part2Comment = `組1[${s1.level}]: ${s1.comment} \n組2[${s2.level}]: ${s2.comment}`;

  // 第三大題：如果我是歌手
  const p3 = gradeCreativeIssue(d.issueTopic, d.issueReason);
  const part3Score = p3.score;
  const part3Comment = `[${p3.level}] ${p3.comment}`;

  // 綜合總分與表現等級
  const totalScore = Number((part1Score + part2Score + part3Score).toFixed(1));
  let overallLevel = '待加強 (C)';
  if (totalScore >= 85) overallLevel = '精熟 (A)';
  else if (totalScore >= 60) overallLevel = '基礎 (B)';

  return {
    classCode,
    seatNo,
    studentName,
    q1Display: `${q1} (${q1Score}分)`,
    q2Display: `${q2} (${q2Score}分)`,
    q3Display: `${q3} (${q3Score}分)`,
    q4Display: `${q4} (${q4Score}分)`,
    q5Display: `${q5} (${q5Score}分)`,
    singer1Name: d.singer1Name || '',
    singer1Song: d.singer1Song || '',
    singer1Reason: d.singer1Reason || '',
    singer2Name: d.singer2Name || '',
    singer2Song: d.singer2Song || '',
    singer2Reason: d.singer2Reason || '',
    issueTopic: d.issueTopic || '',
    issueReason: d.issueReason || '',
    part1Score,
    part2Score,
    part3Score,
    totalScore,
    overallLevel,
    part2Comment,
    part3Comment,
    timestamp
  };
}

/**
 * 星馬歌手給分
 */
function gradeSingleSinger(name, song, reason) {
  name = String(name || '').trim();
  song = String(song || '').trim();
  reason = String(reason || '').trim();

  if (!name && !song && !reason) {
    return { score: 0, level: '未作答', comment: '空白未作答' };
  }

  const nameUpper = name.toUpperCase();
  let isSingMa = false;
  let isKnownWrong = false;

  const allSingMa = SINGER_KNOWLEDGE_BASE.singapore.concat(SINGER_KNOWLEDGE_BASE.malaysia);
  for (let i = 0; i < allSingMa.length; i++) {
    if (nameUpper.includes(allSingMa[i]) || allSingMa[i].includes(nameUpper)) {
      isSingMa = true;
      break;
    }
  }

  for (let j = 0; j < SINGER_KNOWLEDGE_BASE.nonSingMa.length; j++) {
    if (nameUpper.includes(SINGER_KNOWLEDGE_BASE.nonSingMa[j]) || SINGER_KNOWLEDGE_BASE.nonSingMa[j].includes(nameUpper)) {
      isKnownWrong = true;
      break;
    }
  }

  if (isKnownWrong && !isSingMa) {
    return { score: 4, level: '待加強', comment: '非新加坡或馬來西亞籍歌手，請留意地理範疇！' };
  }

  const hasSong = song.length >= 2;
  const reasonLen = reason.length;
  const keywords = ['聲音', '聲線', '唱功', '辨識度', '抒情', '溫柔', '治癒', '療癒', '感動', '歌詞', '旋律', '節奏', '風格', '共鳴', '陪伴', '力量', '故事', '深情', '高音'];
  const hasKeywords = keywords.some(k => reason.includes(k));

  if (isSingMa) {
    if (hasSong && (reasonLen >= 20 || hasKeywords)) {
      return { score: 12.5, level: '精熟／完整', comment: '歌手身分正確，作品具代表性，原因扣合歌聲特質與感受。' };
    } else if (hasSong && reasonLen >= 6) {
      return { score: 9.5, level: '基礎／部分達成', comment: '歌手與作品大致正確，喜歡原因稍顯籠統，可再深入。' };
    } else {
      return { score: 7, level: '基礎／待補強', comment: '歌手身分正確，但作品或心得說明較為簡略。' };
    }
  } else {
    if (hasSong && reasonLen >= 15) {
      return { score: 10.5, level: '審核中(基礎~精熟)', comment: '作品與心得填寫豐富，請教師確認該歌手是否具星馬背景。' };
    }
    return { score: 5, level: '待加強', comment: '歌手背景待確認，或作品與原因描述過於精簡。' };
  }
}

/**
 * 創作題給分
 */
function gradeCreativeIssue(topic, reason) {
  topic = String(topic || '').trim();
  reason = String(reason || '').trim();

  if (!topic && !reason) {
    return { score: 0, level: '未作答', comment: '空白未作答' };
  }

  const issueKeywords = [
    '環境', '海洋', '生態', '土地', '家鄉', '文化', '母語', '霸凌', '校園',
    '心理', '憂鬱', '壓力', '情緒', '弱勢', '關懷', '平等', '親情', '人際',
    '網路', '科技', '自由', '和平', '動保', '動物', '性別', '教育'
  ];
  const hasIssueTopic = issueKeywords.some(k => topic.includes(k) || reason.includes(k)) || topic.length >= 4;
  const reasonLen = reason.length;

  if (hasIssueTopic && reasonLen >= 45) {
    return { score: 24, level: '精熟／深入', comment: '明確提出關懷議題，且能充分結合生活觀察與社會反思，具深刻人文關懷！' };
  } else if (hasIssueTopic && reasonLen >= 18) {
    return { score: 18, level: '基礎／清楚', comment: '有提出想關注的議題與理由，若能再多結合生活經驗或具體案例會更深刻。' };
  } else {
    return { score: 11, level: '待加強／簡短', comment: '論述較為精簡或稍偏空泛，建議多發揮身為歌手時想帶給聽眾的正面影響。' };
  }
}

/**
 * 取得或新建分頁
 */
function getOrCreateSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    buildDoubleHeaders(sheet);
  } else {
    // 檢查是否有第 2 列細項表頭，若沒有才補建，絕不 clear() 清除已有資料
    const b2Val = sheet.getRange(2, 2).getValue();
    if (b2Val !== '座號') {
      buildDoubleHeaders(sheet);
    }
  }
  return sheet;
}

/**
 * 建構高質感的雙層表頭（只更新前 2 列，絕不刪除資料）
 */
function buildDoubleHeaders(sheet) {
  // 1. 寫入第 2 列細項欄位
  sheet.getRange(2, 1, 1, SUB_HEADERS.length).setValues([SUB_HEADERS]);

  // 2. 寫入第 1 列大題群組
  let currentCol = 1;
  for (let i = 0; i < HEADER_GROUPS.length; i++) {
    const group = HEADER_GROUPS[i];
    const range = sheet.getRange(1, currentCol, 1, group.span);
    if (group.span > 1) {
      range.merge();
    }
    range.setValue(group.title);
    range.setBackground(group.bg)
         .setFontColor(group.color)
         .setFontWeight('bold')
         .setFontSize(11)
         .setHorizontalAlignment('center') // 正確 API：setHorizontalAlignment
         .setVerticalAlignment('middle');
    currentCol += group.span;
  }

  // 3. 設定第 2 列細項標題樣式
  const subRange = sheet.getRange(2, 1, 1, SUB_HEADERS.length);
  subRange.setBackground('#f8fafc')
          .setFontColor('#1e293b')
          .setFontWeight('bold')
          .setFontSize(9.5)
          .setHorizontalAlignment('center') // 正確 API：setHorizontalAlignment
          .setVerticalAlignment('middle')
          .setWrap(true);

  sheet.getRange(2, 17, 1, 3).setBackground('#fef3c7').setFontColor('#92400e');
  sheet.getRange(2, 20).setBackground('#b45309').setFontColor('#ffffff');
  sheet.getRange(2, 21).setBackground('#047857').setFontColor('#ffffff');

  sheet.setRowHeight(1, 32);
  sheet.setRowHeight(2, 38);
  sheet.setFrozenRows(2);
  sheet.setFrozenColumns(3);

  const columnWidths = [
    65, 55, 95, 85, 85, 85, 85, 85,
    95, 130, 220, 95, 130, 220, 160, 260,
    95, 95, 95, 120, 110, 220, 220, 120, 145
  ];

  for (let c = 0; c < columnWidths.length; c++) {
    sheet.setColumnWidth(c + 1, columnWidths[c]);
  }
}

/**
 * 精確取得下一個可寫入資料的列號（確保第 1 筆落在第 3 列）
 */
function getNextDataRow(sheet) {
  const maxRows = sheet.getMaxRows();
  if (maxRows <= 2) {
    sheet.insertRowsAfter(maxRows, 20);
    return 3;
  }

  // 讀取第 2 欄 (座號)，從第 3 列開始尋找第一個空白列
  const seatValues = sheet.getRange(3, 2, maxRows - 2, 1).getValues();
  for (let i = 0; i < seatValues.length; i++) {
    const val = seatValues[i][0];
    if (val === '' || val === null || val === undefined) {
      return i + 3; // 1-based 列號
    }
  }

  // 若滿了，新增 5 列並回傳
  sheet.insertRowsAfter(maxRows, 5);
  return maxRows + 1;
}

/**
 * 精確寫入一筆學生資料（不用 appendRow，100% 絕對不會漏掉第 1 筆）
 */
function insertStudentRecord(sheet, d) {
  const targetRow = getNextDataRow(sheet);

  // 總分公式：若 X 欄 (教師手動覆寫) 有值則採 X 欄，否則 SUM(Q:S)
  const totalScoreFormula = `=IF(ISBLANK(X${targetRow}), SUM(Q${targetRow}:S${targetRow}), X${targetRow})`;

  const rowData = [
    d.classCode,
    d.seatNo,
    d.studentName,
    d.q1Display,
    d.q2Display,
    d.q3Display,
    d.q4Display,
    d.q5Display,
    d.singer1Name,
    d.singer1Song,
    d.singer1Reason,
    d.singer2Name,
    d.singer2Song,
    d.singer2Reason,
    d.issueTopic,
    d.issueReason,
    d.part1Score,
    d.part2Score,
    d.part3Score,
    totalScoreFormula,
    d.overallLevel,
    d.part2Comment,
    d.part3Comment,
    '', // 教師手動調整總分 (選填)
    d.timestamp
  ];

  // 精確單次寫入
  sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);

  // 樣式微調（全數採用正確的 setHorizontalAlignment）
  sheet.setRowHeight(targetRow, 42);
  sheet.getRange(targetRow, 1, 1, 8).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.getRange(targetRow, 9, 1, 8).setVerticalAlignment('middle').setWrap(true);
  sheet.getRange(targetRow, 17, 1, 5).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.getRange(targetRow, 20).setFontWeight('bold').setFontSize(12).setFontColor('#b45309').setBackground('#fef3c7');
  sheet.getRange(targetRow, 22, 1, 2).setVerticalAlignment('middle').setWrap(true).setFontSize(9);
  sheet.getRange(targetRow, 24, 1, 2).setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 強制同步試算表
  SpreadsheetApp.flush();
}

/**
 * 依座號由小到大排序（累積 2 筆以上才排序，保護第 1 筆）
 */
function sortSheetBySeatNumber(sheet) {
  SpreadsheetApp.flush();
  const maxRows = sheet.getMaxRows();
  if (maxRows <= 2) return;

  const seatValues = sheet.getRange(3, 2, maxRows - 2, 1).getValues();
  let count = 0;
  for (let i = 0; i < seatValues.length; i++) {
    if (seatValues[i][0] !== '' && seatValues[i][0] !== null) {
      count++;
    } else {
      break;
    }
  }

  if (count >= 2) {
    const dataRange = sheet.getRange(3, 1, count, SUB_HEADERS.length);
    dataRange.sort([{ column: 2, ascending: true }]);
    SpreadsheetApp.flush();
  }
}

/**
 * 清除預設未使用的空工作表
 */
function cleanDefaultSheet(ss) {
  const defaultSheet = ss.getSheetByName('工作表1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    if (defaultSheet.getLastRow() === 0) {
      try {
        ss.deleteSheet(defaultSheet);
      } catch (e) {}
    }
  }
}

/**
 * 一鍵重新美化所有分頁
 */
function reformatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let count = 0;

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    buildDoubleHeaders(sheet);
    count++;
  }

  SpreadsheetApp.getUi().alert(`✅ 已成功重新整理並美化共 ${count} 個分頁！`);
}

/**
 * 救援並修復被寫入到 1000 列以外的漂移資料
 */
function rescueDisplacedData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let rescuedTotal = 0;

  for (let s = 0; s < sheets.length; s++) {
    const sheet = sheets[s];
    const maxRows = sheet.getMaxRows();
    if (maxRows > 100) {
      const farRange = sheet.getRange(100, 2, maxRows - 99, 1).getValues();
      for (let r = 0; r < farRange.length; r++) {
        if (farRange[r][0] !== '' && farRange[r][0] !== null) {
          const sourceRow = r + 100;
          const rowData = sheet.getRange(sourceRow, 1, 1, SUB_HEADERS.length).getValues();
          const targetRow = getNextDataRow(sheet);
          sheet.getRange(targetRow, 1, 1, SUB_HEADERS.length).setValues(rowData);
          sheet.getRange(sourceRow, 1, 1, SUB_HEADERS.length).clearContent();
          rescuedTotal++;
        }
      }
    }
  }

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(`🚑 救援完成！共成功修復並移回 ${rescuedTotal} 筆資料至正常作答區！`);
}
