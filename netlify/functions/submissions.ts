import type { Config } from "@netlify/functions";
import { getDatabase } from "@netlify/database";

// 初始化 Netlify Database 連線
const db = getDatabase();

export default async (req: Request) => {
  const url = new URL(req.url);

  // 1. GET: 查詢學生作答紀錄 (可依班級查詢，如 /api/submissions?class=701)
  if (req.method === "GET") {
    try {
      const classCode = url.searchParams.get("class");

      let rows;
      if (classCode) {
        // 依班級過濾，並依座號由小到大排序
        rows = await db.sql`
          SELECT * FROM submissions 
          WHERE class_code = ${classCode}
          ORDER BY CAST(seat_no AS INTEGER) ASC, id ASC
        `;
      } else {
        // 取得全校作答紀錄，依班級與座號排序
        rows = await db.sql`
          SELECT * FROM submissions 
          ORDER BY class_code ASC, CAST(seat_no AS INTEGER) ASC, id ASC
        `;
      }

      // 取得班級統計數據
      const classStats = await db.sql`
        SELECT 
          class_code, 
          COUNT(*)::int as count, 
          ROUND(AVG(total_score), 1) as avg_score,
          MAX(total_score) as max_score,
          MIN(total_score) as min_score
        FROM submissions 
        GROUP BY class_code 
        ORDER BY class_code ASC
      `;

      return Response.json({
        success: true,
        count: rows.length,
        classes: classStats,
        data: rows
      }, { status: 200 });

    } catch (err: any) {
      console.error("Netlify DB 查詢錯誤:", err);
      return Response.json({
        success: false,
        error: err.message || "查詢資料庫失敗"
      }, { status: 500 });
    }
  }

  // 2. POST: 儲存學生作答紀錄
  if (req.method === "POST") {
    try {
      const body = await req.json();

      const {
        classCode,
        seatNo,
        studentName,
        q1, q2, q3, q4, q5,
        part1Score = 0,
        singer1Name = "",
        singer1Song = "",
        singer1Reason = "",
        singer1Score = 0,
        singer2Name = "",
        singer2Song = "",
        singer2Reason = "",
        singer2Score = 0,
        part2Score = 0,
        part2Comment = "",
        issueTopic = "",
        issueReason = "",
        part3Score = 0,
        part3Comment = "",
        totalScore = 0,
        overallLevel = ""
      } = body;

      if (!classCode || !seatNo || !studentName) {
        return Response.json({
          success: false,
          error: "班級、座號與姓名為必填欄位！"
        }, { status: 400 });
      }

      // 寫入 Postgres 資料庫
      const [inserted] = await db.sql`
        INSERT INTO submissions (
          class_code, seat_no, student_name,
          q1, q2, q3, q4, q5, part1_score,
          singer1_name, singer1_song, singer1_reason, singer1_score,
          singer2_name, singer2_song, singer2_reason, singer2_score,
          part2_score, part2_comment,
          issue_topic, issue_reason,
          part3_score, part3_comment,
          total_score, overall_level
        ) VALUES (
          ${classCode}, ${seatNo}, ${studentName},
          ${q1}, ${q2}, ${q3}, ${q4}, ${q5}, ${part1Score},
          ${singer1Name}, ${singer1Song}, ${singer1Reason}, ${singer1Score},
          ${singer2Name}, ${singer2Song}, ${singer2Reason}, ${singer2Score},
          ${part2Score}, ${part2Comment},
          ${issueTopic}, ${issueReason},
          ${part3Score}, ${part3Comment},
          ${totalScore}, ${overallLevel}
        )
        RETURNING *
      `;

      return Response.json({
        success: true,
        message: `已成功將【${classCode} 班 ${seatNo} 號 ${studentName}】作答儲存至 Netlify Database！`,
        submission: inserted
      }, { status: 201 });

    } catch (err: any) {
      console.error("Netlify DB 寫入錯誤:", err);
      return Response.json({
        success: false,
        error: err.message || "寫入資料庫失敗"
      }, { status: 500 });
    }
  }

  // 3. PATCH: 教師覆寫分數或備註
  if (req.method === "PATCH") {
    try {
      const body = await req.json();
      const { id, teacherOverrideScore, teacherNote } = body;

      if (!id) {
        return Response.json({ success: false, error: "缺少紀錄 ID" }, { status: 400 });
      }

      const [updated] = await db.sql`
        UPDATE submissions 
        SET 
          teacher_override_score = ${teacherOverrideScore},
          teacher_note = ${teacherNote}
        WHERE id = ${id}
        RETURNING *
      `;

      return Response.json({ success: true, updated }, { status: 200 });
    } catch (err: any) {
      return Response.json({ success: false, error: err.message }, { status: 500 });
    }
  }

  // 4. DELETE: 刪除作答紀錄 (支援單筆刪除、依班級清空、全部清空)
  if (req.method === "DELETE") {
    try {
      const id = url.searchParams.get("id");
      const classCode = url.searchParams.get("class");
      const clearAll = url.searchParams.get("all");

      // 單筆刪除 (例如 /api/submissions?id=5)
      if (id) {
        const deleted = await db.sql`
          DELETE FROM submissions 
          WHERE id = ${Number(id)}
          RETURNING id, student_name, class_code, seat_no
        `;
        if (!deleted || deleted.length === 0) {
          return Response.json({ success: false, error: "找不到指定的作答紀錄" }, { status: 404 });
        }
        return Response.json({
          success: true,
          message: `已成功刪除【${deleted[0].class_code} 班 ${deleted[0].seat_no} 號 ${deleted[0].student_name}】的作答紀錄！`,
          deleted: deleted[0]
        }, { status: 200 });
      }

      // 依班級整班清空 (例如 /api/submissions?class=701)
      if (classCode) {
        const deleted = await db.sql`
          DELETE FROM submissions 
          WHERE class_code = ${classCode}
          RETURNING id
        `;
        return Response.json({
          success: true,
          message: `已成功清空【${classCode} 班】共 ${deleted.length} 筆作答紀錄！`,
          count: deleted.length
        }, { status: 200 });
      }

      // 全部清空重設 (例如 /api/submissions?all=true)
      if (clearAll === "true") {
        const deleted = await db.sql`
          DELETE FROM submissions
          RETURNING id
        `;
        return Response.json({
          success: true,
          message: `已成功清空全校資料庫共 ${deleted.length} 筆紀錄！`,
          count: deleted.length
        }, { status: 200 });
      }

      return Response.json({
        success: false,
        error: "請提供要刪除的參數（id、class 或 all）"
      }, { status: 400 });

    } catch (err: any) {
      console.error("Netlify DB 刪除錯誤:", err);
      return Response.json({
        success: false,
        error: err.message || "刪除資料失敗"
      }, { status: 500 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = {
  path: "/api/submissions"
};
