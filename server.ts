import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface PresentationStudent {
  id: string;
  name: string;
  course: string;
  semester: string;
  enrolledAt: string;
}

interface PresentationAttendance {
  id: string;
  studentId: string;
  studentName: string;
  course: string;
  semester: string;
  scannedAt: string;
  tokenUsed: string;
}

let presentationStudents: PresentationStudent[] = [];
let presentationAttendances: PresentationAttendance[] = [];
let currentToken = "LIVE-ON95";
let previousToken = "";
let lastTokenUpdate = Date.now();

function generateNewToken() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; 
  let code = "LIVE-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Rotação de token a cada 60 segundos com tolerância
setInterval(() => {
  previousToken = currentToken;
  currentToken = generateNewToken();
  lastTokenUpdate = Date.now();
  console.log(`Token atualizado: ${currentToken}. Tolerância: ${previousToken} ainda aceito.`);
}, 60000); 

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Nova rota para baixar o CSV
  app.get("/api/download-csv", (req, res) => {
    const header = "Nome,Curso,Semestre,Data/Hora\n";
    const rows = presentationAttendances.map(a => 
      `"${a.studentName}","${a.course}","${a.semester}","${a.scannedAt}"`
    ).join("\n");
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="chamada.csv"');
    res.send(header + rows);
  });

  app.get("/api/presentation/status", (req, res) => {
    const now = Date.now();
    const elapsed = now - lastTokenUpdate;
    const timeLeftMs = Math.max(0, 60000 - elapsed);

    res.json({
      activeToken: currentToken,
      previousToken: previousToken,
      timeLeftMs: timeLeftMs,
      students: presentationStudents,
      attendances: presentationAttendances,
    });
  });

  app.post("/api/presentation/enroll", (req, res) => {
    const { name, course, semester } = req.body;
    const newStudent: PresentationStudent = {
      id: "std-" + Math.random().toString(36).substring(2, 9),
      name: String(name).trim(),
      course: String(course).trim(),
      semester: String(semester).trim(),
      enrolledAt: new Date().toISOString(),
    };
    presentationStudents.push(newStudent);
    res.json({ success: true, student: newStudent });
  });

  app.post("/api/presentation/scan", (req, res) => {
    const { studentId, token } = req.body;
