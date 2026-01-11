import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer) => {
  console.log("🔌 SOCKET.IO INITIALIZING...");

  io = new Server(httpServer, {
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? [process.env.FRONTEND_URL as string]
          : ["http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["polling", "websocket"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    socket.onAny((eventName, ...args) => {
      console.log(`🕵️ SERVER RECEIVED: [${eventName}]`, args);
    });

    // 👇 THIS IS THE MISSING PIECE 👇
    socket.on("join-project", (data: { projectId: string }) => {
      const roomId = data.projectId;

      if (roomId) {
        socket.join(roomId);
        console.log(`✅ User ${socket.id} joined room: ${roomId}`);
      } else {
        console.error(
          "⚠️ Client sent join-project but missing projectId:",
          data
        );
      }
    });
    // 👆 WITHOUT THIS, MESSAGES GO NOWHERE 👆

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
