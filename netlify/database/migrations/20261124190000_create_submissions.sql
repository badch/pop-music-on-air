-- ============================================================================
-- 康軒音樂｜流行音樂開麥拉 Netlify Database 初次遷移腳本
-- 建立學生學習單作答紀錄資料表 (submissions) 與索引
-- ============================================================================

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  class_code VARCHAR(10) NOT NULL,
  seat_no VARCHAR(10) NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  
  -- 第一大題：牛刀小試 (選擇題)
  q1 VARCHAR(10),
  q2 VARCHAR(10),
  q3 VARCHAR(10),
  q4 VARCHAR(10),
  q5 VARCHAR(10),
  part1_score INT DEFAULT 0,
  
  -- 第二大題：星馬歌手
  singer1_name VARCHAR(100),
  singer1_song VARCHAR(255),
  singer1_reason TEXT,
  singer1_score NUMERIC(4, 1) DEFAULT 0,
  singer2_name VARCHAR(100),
  singer2_song VARCHAR(255),
  singer2_reason TEXT,
  singer2_score NUMERIC(4, 1) DEFAULT 0,
  part2_score NUMERIC(4, 1) DEFAULT 0,
  part2_comment TEXT,
  
  -- 第三大題：如果我是歌手 (社會關懷)
  issue_topic TEXT,
  issue_reason TEXT,
  part3_score NUMERIC(4, 1) DEFAULT 0,
  part3_comment TEXT,
  
  -- 綜合評分與表現等級
  total_score NUMERIC(4, 1) DEFAULT 0,
  overall_level VARCHAR(50),
  
  -- 教師手動調整與備註
  teacher_override_score NUMERIC(4, 1),
  teacher_note TEXT,
  
  -- 提交時間戳記
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 建立索引加速班級查詢與座號排序
CREATE INDEX IF NOT EXISTS idx_submissions_class ON submissions(class_code);
CREATE INDEX IF NOT EXISTS idx_submissions_class_seat ON submissions(class_code, seat_no);
CREATE INDEX IF NOT EXISTS idx_submissions_time ON submissions(submitted_at DESC);
