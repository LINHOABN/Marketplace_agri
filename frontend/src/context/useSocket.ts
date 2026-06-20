import { createContext, useContext } from "react";
import { Socket } from "socket.io-client";

export interface SocketContextType {
    socket: Socket | null;
    onlineUsers: string[];
    incomingCall: any | null;
    setIncomingCall: (call: any | null) => void;
    isConnected: boolean;
}

export const SocketContext = createContext<SocketContextType>({
    socket: null,
    onlineUsers: [],
    incomingCall: null,
    setIncomingCall: () => { },
    isConnected: false,
});

export const useSocket = () => useContext(SocketContext);
