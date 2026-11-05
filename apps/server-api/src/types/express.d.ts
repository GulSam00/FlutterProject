/**
 * Express Request 에 요청 추적 ID 를 타입 안전하게 추가한다.
 * (req as any).requestId 같은 캐스팅을 코드베이스 전역에서 제거하기 위함.
 */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export {};
