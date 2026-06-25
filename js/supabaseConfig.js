/************************************************************
 * supabaseConfig.js
 * Supabase 项目配置
 *
 * 注意：
 * - anonKey 是 Supabase 前端公开密钥，不是 service_role 密钥。
 * - accountDomain 用于把“初始账号”转换成邮箱登录；例如账号 zhangsan
 *   会按 zhangsan@classrecord.local 提交给 Supabase Auth。
 ************************************************************/

window.CLASS_RECORD_SUPABASE = {
    url: "https://xyeftofxlxbpqctuuqup.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5ZWZ0b2Z4bHhicHFjdHV1cXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTM2NTMsImV4cCI6MjA5Nzk2OTY1M30.ympDVX6Hqbscc9BWzWLU8Ur-FUNgD3kGaLsrt9o0Gkg",
    accountDomain: "classrecord.local",
    tables: {
        profiles: "profiles",
        reactions: "record_reactions",
        comments: "record_comments",
        records: "class_records",
        people: "class_people",
        glossary: "class_glossary",
        recordPages: "class_record_pages",
        quizQuestions: "class_quiz_questions"
    },
    storage: {
        privateBucket: "classrecord-private",
        signedUrlExpiresIn: 600
    },
    useSecureContent: true
};
