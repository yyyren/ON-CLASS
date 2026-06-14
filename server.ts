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

// Intervalo aumentado para 60 segundos para evitar expiração
setInterval(() => {
  previousToken = currentToken;
  currentToken = generateNewToken();
  lastTokenUpdate = Date.now();
}, 60000); 

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Rota para baixar a planilha de presença
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
    const timeLeftMs = Math.max(0, 60000 - elapsed); // Ajustado para 60s

    res.json({
      activeToken: currentToken,
      previousToken: previousToken,
      timeLeftMs: timeLeftMs,
      students: presentationStudents,
      attendances: presentationAttendances,
    });
  });

  app.post("/api/presentation/scan", (req, res) => {
    const { studentId, token } = req.body;
    
    const student = presentationStudents.find(s => s.id === studentId);
    if (!student) return res.status(404).json({ error: "Aluno não encontrado." });

    if (presentationAttendances.some(a => a.studentId === studentId)) {
      return res.status(400).json({ error: "Você já registrou sua presença!" });
    }

    const upperToken = String(token).trim().toUpperCase();
    // Aceita o token atual OU o anterior para evitar erro na troca
    if (upperToken !== currentToken && upperToken !== previousToken) {
      return res.status(400).json({ error: "Código expirado. Aguarde o próximo." });
    }

    presentationAttendances.unshift({
      id: "att-" + Math.random().toString(36).substring(2, 9),
      studentId: student.id,
      studentName: student.name,
      course: student.course,
      semester: student.semester,
      scannedAt: new Date().toISOString(),
      tokenUsed: upperToken,
    });

    res.json({ success: true, message: "Presença registrada!" });
  });

  // ... (restante das rotas de enroll e reset mantêm-se iguais)

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
}

startServer();
