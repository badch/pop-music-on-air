/**
 * 康軒音樂｜流行音樂開麥拉 學習單前端互動邏輯
 * 包含：表單驗證、即時格式防呆、第一大題自動批改、評分預覽、Google Sheets 整合與離線備份
 */

// 正確解答與詳解
const QUIZ_ANSWERS = {
  q1: {
    correct: 'C',
    answerText: '蘇打綠',
    explanation: '蘇打綠曾與德國交響樂團合作，於西元 2009 年啟動以四季為靈感的「韋瓦第計畫」，推出《春·日光》、《夏／狂熱》、《秋：故事》、《冬　未了》四張結合古典與流行的代表作。'
  },
  q2: {
    correct: 'A',
    answerText: '〈島嶼天光〉',
    explanation: '滅火器樂團創作的〈島嶼天光〉獲得第 26 屆金曲獎「最佳年度歌曲獎」，深刻記錄了臺灣社會與青年世代的集體記憶與土地關懷。'
  },
  q3: {
    correct: 'C',
    answerText: '舒米恩．魯碧',
    explanation: '阿美族創作歌手舒米恩．魯碧（Suming Rupi）巧妙將原住民阿美族傳統古調與現代流行電音曲風融合，並創立阿米斯音樂節，深耕母語文化推廣。'
  },
  q4: {
    correct: 'B',
    answerText: '謝金燕',
    explanation: '「電音天后」謝金燕大膽將動感節奏的電子舞曲融入閩南語歌曲（如〈練舞功〉、〈姐姐〉），打破了傳統台語歌曲抒情哀怨的刻板框架。'
  },
  q5: {
    correct: 'D',
    answerText: '荒山亮',
    explanation: '金曲歌王荒山亮長期為霹靂布袋戲製作與演唱配樂，將搖滾、交響樂、現代流行曲風融入布袋戲英雄主題曲，展現傳統偶戲音樂的嶄新面貌。'
  }
};

// 星馬歌手參考辨識庫（用於即時提醒與智能輔助評分）
const SINGER_DATABASE = {
  singapore: ['孫燕姿', '林俊傑', 'JJ', 'JJ LIN', '蔡健雅', '阿杜', '陳潔儀', '黃義達', 'OLIVIA ONG', '文慧如', '邱鋒澤', '董姿彥'],
  malaysia: ['梁靜茹', '光良', '品冠', '無印良品', '戴佩妮', '黃明志', '張棟樑', '陳勢安', '曹格', '李佳薇', '李心潔', '阿牛', '陳慶祥', '宇珩', '方泂鑌', '張智成'],
  nonSingMa: ['周杰倫', '蔡依林', '五月天', '張惠妹', 'A-MEI', '蕭敬騰', '羅志祥', '江蕙', '謝金燕', '蘇打綠', '滅火器', '草東沒有派對', '茄子蛋', '林生祥', '蕭煌奇', '鄧紫棋', '陳奕迅', '王力宏', '陶喆']
};

// 老師設定的 GAS 網址（可直接寫在此處做為全班預設，或由右上角⚙️齒輪設定儲存在 LocalStorage）
const DEFAULT_GAS_URL = ''; 
const STORAGE_KEY_GAS_URL = 'MUSIC_WORKSHEET_GAS_URL';
const STORAGE_KEY_SUBMISSIONS = 'MUSIC_WORKSHEET_SUBMISSIONS';

// DOM 元素
const form = document.getElementById('worksheetForm');
const inputClass = document.getElementById('inputClass');
const inputSeat = document.getElementById('inputSeat');
const inputName = document.getElementById('inputName');
const groupClass = document.getElementById('groupClass');
const groupSeat = document.getElementById('groupSeat');
const groupName = document.getElementById('groupName');
const tipClass = document.getElementById('tipClass');
const tipSeat = document.getElementById('tipSeat');

const countSinger1 = document.getElementById('countSinger1');
const countSinger2 = document.getElementById('countSinger2');
const countIssueReason = document.getElementById('countIssueReason');

const loadingModal = document.getElementById('loadingModal');
const resultModal = document.getElementById('resultModal');
const configModal = document.getElementById('configModal');
const gasUrlInput = document.getElementById('gasUrlInput');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadConfig();
});

function initEventListeners() {
  // 班級即時驗證：格式如 701, 802, 915
  inputClass.addEventListener('input', validateClassInput);
  inputClass.addEventListener('blur', validateClassInput);

  // 座號即時驗證：兩位數 01~99
  inputSeat.addEventListener('input', validateSeatInput);
  inputSeat.addEventListener('blur', () => {
    // 若學生只輸入 1 位數 (例如 5)，自動在前方補零為 05
    let val = inputSeat.value.trim();
    if (val.length === 1 && /^[1-9]$/.test(val)) {
      inputSeat.value = '0' + val;
    }
    validateSeatInput();
  });

  // 姓名即時驗證
  inputName.addEventListener('input', validateNameInput);
  inputName.addEventListener('blur', validateNameInput);

  // 字數統計監聽
  setupCharCounter('singer1Reason', countSinger1);
  setupCharCounter('singer2Reason', countSinger2);
  setupCharCounter('issueReason', countIssueReason);

  // 選擇題點擊即時清除該題錯誤紅框
  for (let i = 1; i <= 5; i++) {
    const radios = document.querySelectorAll(`input[name="q${i}"]`);
    radios.forEach(radio => {
      radio.addEventListener('change', () => {
        document.getElementById(`itemQ${i}`).classList.remove('has-error');
      });
    });
  }

  // 第二、三大題輸入時清除錯誤提示
  const textInputs = [
    'singer1Name', 'singer1Song', 'singer1Reason',
    'singer2Name', 'singer2Song', 'singer2Reason',
    'issueTopic', 'issueReason'
  ];
  textInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        el.parentElement.classList.remove('has-error');
      });
    }
  });

  // 表單送出
  form.addEventListener('submit', handleFormSubmit);

  // 老師設定彈窗控制
  document.getElementById('btnOpenConfig').addEventListener('click', () => {
    configModal.classList.add('active');
  });
  document.getElementById('btnCloseConfig').addEventListener('click', () => {
    configModal.classList.remove('active');
  });
  document.getElementById('btnSaveConfig').addEventListener('click', saveConfig);

  // 測試連線按鈕
  const btnTestConn = document.getElementById('btnTestConn');
  if (btnTestConn) {
    btnTestConn.addEventListener('click', testGasConnection);
  }

  // 匯出 CSV 備份
  document.getElementById('btnExportCsv').addEventListener('click', exportLocalSubmissionsToCsv);

  // 結果彈窗控制
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    resultModal.classList.remove('active');
  });
  document.getElementById('btnPrint').addEventListener('click', () => {
    window.print();
  });
}

/**
 * 班級代碼驗證：需為3位數（如701表示7年級1班）
 */
function validateClassInput() {
  const val = inputClass.value.trim();
  // 支援 701~999 格式（7~9年級 + 兩位班級）
  const classRegex = /^[7-9][0-9]{2}$/;

  if (!val) {
    setClassState('none');
    return false;
  }

  if (classRegex.test(val)) {
    const grade = val.charAt(0);
    const cls = parseInt(val.substring(1), 10);
    tipClass.textContent = `✅ 正確：${grade} 年級 ${cls} 班`;
    setClassState('success');
    return true;
  } else {
    document.getElementById('errorClass').textContent = '❌ 請填入正確格式（例如 7 年級 1 班請填 701）';
    setClassState('error');
    return false;
  }
}

function setClassState(state) {
  groupClass.classList.remove('has-error', 'has-success');
  if (state === 'error') groupClass.classList.add('has-error');
  if (state === 'success') groupClass.classList.add('has-success');
}

/**
 * 座號驗證：需為兩位數（01~99）
 */
function validateSeatInput() {
  const val = inputSeat.value.trim();
  const seatRegex = /^(0[1-9]|[1-9][0-9])$/;

  if (!val) {
    setSeatState('none');
    return false;
  }

  if (seatRegex.test(val)) {
    tipSeat.textContent = `✅ 正確：座號 ${val} 號`;
    setSeatState('success');
    return true;
  } else {
    document.getElementById('errorSeat').textContent = '❌ 座號請填寫兩位數（例如：05、18）';
    setSeatState('error');
    return false;
  }
}

function setSeatState(state) {
  groupSeat.classList.remove('has-error', 'has-success');
  if (state === 'error') groupSeat.classList.add('has-error');
  if (state === 'success') groupSeat.classList.add('has-success');
}

/**
 * 姓名驗證
 */
function validateNameInput() {
  const val = inputName.value.trim();
  if (val.length >= 2) {
    groupName.classList.remove('has-error');
    groupName.classList.add('has-success');
    return true;
  } else {
    groupName.classList.remove('has-success');
    if (val.length > 0) {
      groupName.classList.add('has-error');
    }
    return false;
  }
}

/**
 * 字數計數器
 */
function setupCharCounter(inputId, counterEl) {
  const input = document.getElementById(inputId);
  if (!input || !counterEl) return;
  input.addEventListener('input', () => {
    const len = input.value.trim().length;
    counterEl.textContent = `${len} 字`;
  });
}

/**
 * 全面檢驗表單合法性
 */
function validateEntireForm() {
  let isValid = true;
  let firstErrorElement = null;

  // 1. 學生基本資料
  if (!validateClassInput()) {
    isValid = false;
    groupClass.classList.add('has-error');
    firstErrorElement = firstErrorElement || inputClass;
  }

  if (!validateSeatInput()) {
    isValid = false;
    groupSeat.classList.add('has-error');
    firstErrorElement = firstErrorElement || inputSeat;
  }

  if (!validateNameInput()) {
    isValid = false;
    groupName.classList.add('has-error');
    firstErrorElement = firstErrorElement || inputName;
  }

  // 2. 第一大題選擇題
  for (let i = 1; i <= 5; i++) {
    const checked = document.querySelector(`input[name="q${i}"]:checked`);
    const itemEl = document.getElementById(`itemQ${i}`);
    if (!checked) {
      isValid = false;
      itemEl.classList.add('has-error');
      firstErrorElement = firstErrorElement || itemEl;
    } else {
      itemEl.classList.remove('has-error');
    }
  }

  // 3. 第二大題星馬歌手
  const singerFields = [
    { id: 'singer1Name', min: 1 },
    { id: 'singer1Song', min: 1 },
    { id: 'singer1Reason', min: 3 },
    { id: 'singer2Name', min: 1 },
    { id: 'singer2Song', min: 1 },
    { id: 'singer2Reason', min: 3 }
  ];

  singerFields.forEach(field => {
    const el = document.getElementById(field.id);
    const parent = el.closest('.form-group') || el.parentElement;
    if (!el.value.trim() || el.value.trim().length < field.min) {
      isValid = false;
      parent.classList.add('has-error');
      firstErrorElement = firstErrorElement || el;
    } else {
      parent.classList.remove('has-error');
    }
  });

  // 4. 第三大題如果我是歌手
  const topicEl = document.getElementById('issueTopic');
  const reasonEl = document.getElementById('issueReason');

  if (!topicEl.value.trim()) {
    isValid = false;
    topicEl.parentElement.classList.add('has-error');
    firstErrorElement = firstErrorElement || topicEl;
  } else {
    topicEl.parentElement.classList.remove('has-error');
  }

  if (!reasonEl.value.trim() || reasonEl.value.trim().length < 5) {
    isValid = false;
    reasonEl.parentElement.classList.add('has-error');
    firstErrorElement = firstErrorElement || reasonEl;
  } else {
    reasonEl.parentElement.classList.remove('has-error');
  }

  const warningBanner = document.getElementById('formGlobalWarning');
  if (!isValid) {
    warningBanner.style.display = 'block';
    if (firstErrorElement) {
      firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstErrorElement.classList.add('shake');
      setTimeout(() => firstErrorElement.classList.remove('shake'), 500);
      if (typeof firstErrorElement.focus === 'function') {
        firstErrorElement.focus();
      }
    }
  } else {
    warningBanner.style.display = 'none';
  }

  return isValid;
}

/**
 * 評分計算引擎（第一大題自動算分，第二、三大題智慧評估建議）
 */
function evaluateAnswers(formData) {
  // 1. 第一大題（選擇題5題，每題10分，共50分）
  let part1Score = 0;
  const part1Details = {};

  for (let i = 1; i <= 5; i++) {
    const userChoice = formData[`q${i}`];
    const itemData = QUIZ_ANSWERS[`q${i}`];
    const isCorrect = userChoice === itemData.correct;
    if (isCorrect) part1Score += 10;

    part1Details[`q${i}`] = {
      userChoice,
      correctChoice: itemData.correct,
      isCorrect,
      score: isCorrect ? 10 : 0,
      answerText: itemData.answerText,
      explanation: itemData.explanation
    };
  }

  // 2. 第二大題（星馬歌手智能檢核評估）
  const part2Eval = evaluateSingers(
    formData.singer1Name, formData.singer1Song, formData.singer1Reason,
    formData.singer2Name, formData.singer2Song, formData.singer2Reason
  );

  // 3. 第三大題（如果我是歌手智能評估）
  const part3Eval = evaluateCreative(formData.issueTopic, formData.issueReason);

  // 總分估計
  const totalScore = part1Score + part2Eval.totalScore + part3Eval.score;

  return {
    part1Score,
    part1Details,
    part2Eval,
    part3Eval,
    totalScore
  };
}

/**
 * 第二大題給分標準評估演算法
 */
function evaluateSingers(s1Name, s1Song, s1Reason, s2Name, s2Song, s2Reason) {
  const g1 = scoreSingleSinger(s1Name, s1Song, s1Reason);
  const g2 = scoreSingleSinger(s2Name, s2Song, s2Reason);
  const totalScore = Math.min(25, +(g1.score + g2.score).toFixed(1));

  return {
    group1: g1,
    group2: g2,
    totalScore: totalScore,
    feedback: `第1組評等：${g1.level} (${g1.score}分)；第2組評等：${g2.level} (${g2.score}分)`
  };
}

function scoreSingleSinger(name, song, reason) {
  name = (name || '').trim();
  song = (song || '').trim();
  reason = (reason || '').trim();

  let nameUpper = name.toUpperCase();
  let isSingMa = false;
  let isWrongArtist = false;

  // 檢查是否在星馬庫中
  for (let item of [...SINGER_DATABASE.singapore, ...SINGER_DATABASE.malaysia]) {
    if (nameUpper.includes(item) || item.includes(nameUpper)) {
      isSingMa = true;
      break;
    }
  }

  // 檢查是否為常見易錯非星馬歌手
  for (let item of SINGER_DATABASE.nonSingMa) {
    if (nameUpper.includes(item) || item.includes(nameUpper)) {
      isWrongArtist = true;
      break;
    }
  }

  // 判定
  if (isWrongArtist && !isSingMa) {
    return {
      score: 4,
      level: '待加強',
      comment: '⚠️ 注意：該歌手非新加坡或馬來西亞籍，請注意星馬歌手的地理定義喔！'
    };
  }

  const hasSpecificSong = song.length >= 2;
  const reasonLen = reason.length;
  // 檢測理由是否具體（關鍵字如：聲音、聲線、辨識度、溫柔、治癒、感動、歌詞、旋律、故事、共鳴、陪伴）
  const sentimentKeywords = ['聲音', '聲線', '唱功', '辨識度', '抒情', '溫柔', '治癒', '療癒', '感動', '歌詞', '旋律', '節奏', '風格', '共鳴', '陪伴', '力量', '故事', '深情', '高音', '穿透力'];
  const hasKeywords = sentimentKeywords.some(kw => reason.includes(kw));

  if (isSingMa && hasSpecificSong && (reasonLen >= 20 || hasKeywords)) {
    return {
      score: 12.5,
      level: '精熟／完整',
      comment: '歌手身分正確，作品具代表性，喜歡原因扣合歌聲特質與感受，敘述完整！'
    };
  } else if (isSingMa && hasSpecificSong && reasonLen >= 6) {
    return {
      score: 9.5,
      level: '基礎／部分達成',
      comment: '歌手與作品大致正確，若能再多描寫歌聲特質或聽歌共鳴會更精采。'
    };
  } else if (isSingMa) {
    return {
      score: 7,
      level: '基礎／待補強',
      comment: '歌手身分正確，但作品或原因說明稍顯簡略。'
    };
  } else {
    // 可能是未在庫中的星馬歌手，依內容豐富度給予彈性評分
    if (hasSpecificSong && reasonLen >= 15) {
      return {
        score: 10,
        level: '審核中(基礎~精熟)',
        comment: '作品與心得填寫完整，待教師複核歌手國籍。'
      };
    }
    return {
      score: 5,
      level: '待加強',
      comment: '內容填寫稍嫌簡短，請多補充代表作與聆聽原因。'
    };
  }
}

/**
 * 第三大題給分標準評估演算法
 */
function evaluateCreative(topic, reason) {
  topic = (topic || '').trim();
  reason = (reason || '').trim();

  const issueKeywords = ['環境', '海洋', '生態', '土地', '家鄉', '文化', '母語', '霸凌', '校園', '心理', '憂鬱', '壓力', '情緒', '弱勢', '關懷', '平等', '親情', '人際', '網路', '科技', '自由', '和平'];
  const hasIssue = issueKeywords.some(kw => topic.includes(kw) || reason.includes(kw)) || topic.length >= 4;

  const reasonLen = reason.length;

  if (hasIssue && reasonLen >= 45) {
    return {
      score: 24,
      level: '精熟／深入',
      comment: '議題明確深刻，且能充分結合個人觀察或社會責任反思，展現音樂人文關懷！'
    };
  } else if (hasIssue && reasonLen >= 20) {
    return {
      score: 18,
      level: '基礎／清楚',
      comment: '有提出明確想法與理由，若能再補充具體生活案例或更深刻的行動反思會更棒。'
    };
  } else {
    return {
      score: 11,
      level: '待加強／簡短',
      comment: '論述較為精簡，建議再多發揮身為具影響力歌手時的理念與想帶給聽眾的力量。'
    };
  }
}

/**
 * 處理表單提交
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  if (!validateEntireForm()) {
    return;
  }

  // 收集表單資料
  const formData = {
    classCode: inputClass.value.trim(),
    seatNo: inputSeat.value.trim(),
    studentName: inputName.value.trim(),
    q1: (document.querySelector('input[name="q1"]:checked') || {}).value || '',
    q2: (document.querySelector('input[name="q2"]:checked') || {}).value || '',
    q3: (document.querySelector('input[name="q3"]:checked') || {}).value || '',
    q4: (document.querySelector('input[name="q4"]:checked') || {}).value || '',
    q5: (document.querySelector('input[name="q5"]:checked') || {}).value || '',
    singer1Name: document.getElementById('singer1Name').value.trim(),
    singer1Song: document.getElementById('singer1Song').value.trim(),
    singer1Reason: document.getElementById('singer1Reason').value.trim(),
    singer2Name: document.getElementById('singer2Name').value.trim(),
    singer2Song: document.getElementById('singer2Song').value.trim(),
    singer2Reason: document.getElementById('singer2Reason').value.trim(),
    issueTopic: document.getElementById('issueTopic').value.trim(),
    issueReason: document.getElementById('issueReason').value.trim(),
    timestamp: new Date().toLocaleString('zh-TW', { hour12: false })
  };

  // 執行即時評分
  const evalResult = evaluateAnswers(formData);
  formData.evalResult = evalResult;

  // 儲存於本機 LocalStorage 作為備份防呆
  saveToLocalStorage(formData);

  // 顯示 Loading
  loadingModal.classList.add('active');

  // 發送至 Netlify Database 與 Google Apps Script 試算表
  const gasUrl = getGasUrl();
  let syncStatus = {
    connected: false,
    message: ''
  };

  const netlifyPayload = {
    classCode: formData.classCode,
    seatNo: formData.seatNo,
    studentName: formData.studentName,
    q1: formData.q1,
    q2: formData.q2,
    q3: formData.q3,
    q4: formData.q4,
    q5: formData.q5,
    part1Score: evalResult.part1Score,
    singer1Name: formData.singer1Name,
    singer1Song: formData.singer1Song,
    singer1Reason: formData.singer1Reason,
    singer1Score: evalResult.part2Eval.group1.score,
    singer2Name: formData.singer2Name,
    singer2Song: formData.singer2Song,
    singer2Reason: formData.singer2Reason,
    singer2Score: evalResult.part2Eval.group2.score,
    part2Score: evalResult.part2Eval.totalScore,
    part2Comment: evalResult.part2Eval.feedback,
    issueTopic: formData.issueTopic,
    issueReason: formData.issueReason,
    part3Score: evalResult.part3Eval.score,
    part3Comment: evalResult.part3Eval.comment,
    totalScore: evalResult.totalScore,
    overallLevel: (evalResult.totalScore >= 85 ? '精熟 (A)' : evalResult.totalScore >= 60 ? '基礎 (B)' : '待加強 (C)')
  };

  let netlifySuccess = false;
  try {
    const netlifyRes = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(netlifyPayload)
    });
    if (netlifyRes.ok) {
      netlifySuccess = true;
    }
  } catch (err) {
    // 本地純靜態或尚未部署 Functions
  }

  let gasSuccess = false;
  if (gasUrl) {
    try {
      const payload = {
        action: 'submitWorksheet',
        timestamp: formData.timestamp,
        ...netlifyPayload
      };

      await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
      gasSuccess = true;
    } catch (err) {
      console.error('Google 試算表上傳錯誤：', err);
    }
  }

  // 狀態整合回饋
  if (netlifySuccess && gasSuccess) {
    syncStatus.connected = true;
    syncStatus.message = '🎉 完美同步！作答已成功寫入 Netlify Database 與 Google 試算表！';
  } else if (netlifySuccess) {
    syncStatus.connected = true;
    syncStatus.message = '✅ 作答已成功儲存至 Netlify Database 資料庫（Postgres）！';
  } else if (gasSuccess) {
    syncStatus.connected = true;
    syncStatus.message = '✅ 資料已成功送出並同步寫入 Google 試算表各班分頁！';
  } else {
    syncStatus.connected = false;
    syncStatus.message = '⚠️ 作答已安全暫存於本機瀏覽器。可在設定中串接 Google 試算表或直接部署至 Netlify Database！';
  }

  // 延遲一點點展現黑膠動畫效果
  setTimeout(() => {
    loadingModal.classList.remove('active');
    showResultModal(formData, evalResult, syncStatus);
  }, 1000);
}

/**
 * 展現成功完成視窗與題目解析
 */
function showResultModal(formData, evalResult, syncStatus) {
  document.getElementById('resClass').textContent = `班級：${formData.classCode}`;
  document.getElementById('resSeat').textContent = `座號：${formData.seatNo}`;
  document.getElementById('resName').textContent = `姓名：${formData.studentName}`;

  // 雲端同步狀態標籤
  const bannerEl = document.getElementById('resCloudBanner');
  if (bannerEl) {
    bannerEl.textContent = syncStatus.message;
    bannerEl.className = 'cloud-banner ' + (syncStatus.connected ? 'banner-success' : 'banner-warning');
  }

  document.getElementById('resPart1Score').textContent = evalResult.part1Score;
  const tagEl = document.getElementById('resPart1Tag');
  if (evalResult.part1Score === 50) {
    tagEl.textContent = '滿分 50 分！完全答對！';
    tagEl.style.background = '#10b981';
  } else if (evalResult.part1Score >= 30) {
    tagEl.textContent = `答對 ${evalResult.part1Score / 10} 題，表現良好！`;
    tagEl.style.background = '#3b82f6';
  } else {
    tagEl.textContent = '需再加油，請參考下方解析！';
    tagEl.style.background = '#f59e0b';
  }

  document.getElementById('evalPart1').textContent = `${evalResult.part1Score} / 50 分`;
  document.getElementById('evalPart2').textContent = `建議 ${evalResult.part2Eval.totalScore} / 25 分 (${evalResult.part2Eval.group1.level})`;
  document.getElementById('evalPart3').textContent = `建議 ${evalResult.part3Eval.score} / 25 分 (${evalResult.part3Eval.level})`;

  // 生成選擇題解析列表
  const explanationList = document.getElementById('explanationList');
  explanationList.innerHTML = '';

  for (let i = 1; i <= 5; i++) {
    const d = evalResult.part1Details[`q${i}`];
    const itemDiv = document.createElement('div');
    itemDiv.className = `exp-item ${d.isCorrect ? 'correct' : 'wrong'}`;

    itemDiv.innerHTML = `
      <div class="exp-head">
        <span>第 ${i} 題：${d.isCorrect ? '✅ 答對 (+10分)' : '❌ 答錯 (0分)'}</span>
        <span>你的選擇：(${d.userChoice}) ｜ 正確答案：(${d.correctChoice}) ${d.answerText}</span>
      </div>
      <div class="exp-text">${d.explanation}</div>
    `;
    explanationList.appendChild(itemDiv);
  }

  resultModal.classList.add('active');
}

/**
 * LocalStorage 存取與備份
 */
function saveToLocalStorage(data) {
  try {
    let list = JSON.parse(localStorage.getItem(STORAGE_KEY_SUBMISSIONS) || '[]');
    list.push(data);
    localStorage.setItem(STORAGE_KEY_SUBMISSIONS, JSON.stringify(list));
  } catch (e) {
    console.error('儲存本機記錄失敗', e);
  }
}

function exportLocalSubmissionsToCsv() {
  const raw = localStorage.getItem(STORAGE_KEY_SUBMISSIONS);
  if (!raw) {
    alert('目前本機尚未有任何繳交紀錄！');
    return;
  }
  const list = JSON.parse(raw);
  if (!list.length) {
    alert('目前無可匯出的資料！');
    return;
  }

  const headers = [
    '填寫時間', '班級', '座號', '姓名',
    'Q1', 'Q2', 'Q3', 'Q4', 'Q5', '第一大題得分',
    '星馬歌手1', '作品1', '原因1', '第1組建議得分',
    '星馬歌手2', '作品2', '原因2', '第2組建議得分', '第二大題總分',
    '關心議題', '為什麼與反思', '第三大題建議得分', '綜合總分預估'
  ];

  const rows = list.map(item => [
    `"${item.timestamp}"`,
    `"${item.classCode}"`,
    `"${item.seatNo}"`,
    `"${item.studentName}"`,
    `"${item.q1}"`,
    `"${item.q2}"`,
    `"${item.q3}"`,
    `"${item.q4}"`,
    `"${item.q5}"`,
    item.evalResult?.part1Score ?? '',
    `"${(item.singer1Name || '').replace(/"/g, '""')}"`,
    `"${(item.singer1Song || '').replace(/"/g, '""')}"`,
    `"${(item.singer1Reason || '').replace(/"/g, '""')}"`,
    item.evalResult?.part2Eval?.group1?.score ?? '',
    `"${(item.singer2Name || '').replace(/"/g, '""')}"`,
    `"${(item.singer2Song || '').replace(/"/g, '""')}"`,
    `"${(item.singer2Reason || '').replace(/"/g, '""')}"`,
    item.evalResult?.part2Eval?.group2?.score ?? '',
    item.evalResult?.part2Eval?.totalScore ?? '',
    `"${(item.issueTopic || '').replace(/"/g, '""')}"`,
    `"${(item.issueReason || '').replace(/"/g, '""')}"`,
    item.evalResult?.part3Eval?.score ?? '',
    item.evalResult?.totalScore ?? ''
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `流行音樂開麥拉_學生作答彙整_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 讀取教師 GAS 網址（優先讀取 LocalStorage，次之讀取程式預設常數）
 */
function getGasUrl() {
  const local = localStorage.getItem(STORAGE_KEY_GAS_URL);
  if (local && local.trim()) return local.trim();
  return DEFAULT_GAS_URL.trim();
}

function loadConfig() {
  const saved = getGasUrl();
  if (saved) {
    gasUrlInput.value = saved;
  }
}

function saveConfig() {
  const url = gasUrlInput.value.trim();
  if (url && !url.startsWith('https://script.google.com/')) {
    alert('請確認網址是否為 Google Apps Script 產生的網址（應以 https://script.google.com/ 開頭）');
    return;
  }
  localStorage.setItem(STORAGE_KEY_GAS_URL, url);
  alert('✅ Google 試算表 Web App 網址設定已儲存！');
  configModal.classList.remove('active');
}

/**
 * 測試 GAS 網址連線狀態
 */
async function testGasConnection() {
  const url = gasUrlInput.value.trim();
  const msgEl = document.getElementById('testConnMsg');
  if (!msgEl) return;

  if (!url) {
    msgEl.style.display = 'block';
    msgEl.style.color = '#ef4444';
    msgEl.textContent = '❌ 請先輸入 Google Apps Script 網址再測試！';
    return;
  }

  if (!url.startsWith('https://script.google.com/')) {
    msgEl.style.display = 'block';
    msgEl.style.color = '#ef4444';
    msgEl.textContent = '❌ 網址格式不正確，應以 https://script.google.com/ 開頭';
    return;
  }

  msgEl.style.display = 'block';
  msgEl.style.color = '#3b82f6';
  msgEl.textContent = '⏳ 正在測試連線...';

  try {
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    if (data && data.status === 'success') {
      msgEl.style.color = '#10b981';
      msgEl.textContent = '✅ 連線成功！試算表後端正在正常運行，可正常接收學生作答！';
    } else {
      msgEl.style.color = '#10b981';
      msgEl.textContent = '✅ 已成功連線至 Web App！';
    }
  } catch (err) {
    // 跨域或權限問題
    msgEl.style.color = '#f59e0b';
    msgEl.textContent = '⚠️ 無法直接讀取回應（可能是跨網域限制或權限未開放）。請務必確認部署設定中的「誰可以存取」已設為「所有人（Anyone）」！';
  }
}
