import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { HTTP_HEADERS } from '@repo/shared-types';

/** 외부에서 주입된 ID 는 형식을 제한한다 → 로그 인젝션(개행 삽입) 및 과도한 길이 방지 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * 요청 ID 전파 미들웨어.
 * - Nginx/Ingress 가 이미 `X-Request-ID` 를 붙였다면 그대로 재사용 → 프록시 로그와 앱 로그를 하나의 ID 로 조인 가능
 * - 없거나 형식이 의심스러우면 새로 발급
 * - 응답 헤더로 되돌려 주어 클라이언트가 CS 문의 시 ID 를 제공할 수 있게 한다
 *
 * Nest 의 MiddlewareConsumer 대신 `app.use()` 로 등록하는 이유:
 * 라우트 매칭 이전(404 포함)의 모든 요청에도 ID 가 있어야 에러 응답에 requestId 를 실을 수 있기 때문.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HTTP_HEADERS.REQUEST_ID);
  const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  req.requestId = requestId;
  res.setHeader(HTTP_HEADERS.REQUEST_ID, requestId);
  next();
}
