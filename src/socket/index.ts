import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer) => {
  // 1. Initialize Socket.io with the HTTP Server
  console.log("🔌 SOCKET.IO INITIALIZING...");
  io = new Server(httpServer, {
    // 2. THIS IS CRITICAL: Socket.io has its own CORS config
    cors: {
      origin:
        process.env.NODE_ENV === "production"
          ? [process.env.FRONTEND_URL as string] // e.g. "https://signoff.vercel.app"
          : ["http://localhost:5173"],
      credentials: true,
      methods: ["GET", "POST"],
    },
    // 3. Ensure path defaults to /socket.io/ (standard)
    // path: "/socket.io/",
    // 4. Cloud Run requires this for stability
    transports: ["polling", "websocket"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Export a getter to use 'io' in controllers
export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
