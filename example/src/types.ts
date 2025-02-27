export interface ResponseData {
    status: 'success' | 'error';
    data?: any;
    message?: string;
    timestamp: string;
    operation?: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'QUERY' | 'REGISTER' | 'LOGIN';
}

export interface WebSocketMessage {
    type: string;
    requestId: string;
    data?: any;
    message?: string;
    timestamp: string;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
} 