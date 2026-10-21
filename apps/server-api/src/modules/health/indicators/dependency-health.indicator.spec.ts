import { probeDependency } from './dependency-health.indicator';

describe('probeDependency', () => {
  it('성공 시 up', async () => {
    await expect(probeDependency(() => Promise.resolve('PONG'), 100)).resolves.toMatchObject({
      status: 'up',
    });
  });

  it('예외를 삼키고 내부 메시지를 노출하지 않는다', async () => {
    const result = await probeDependency(
      () => Promise.reject(new Error('ECONNREFUSED 10.0.0.5:5432')),
      100,
    );
    expect(result).toMatchObject({ status: 'down', message: 'unreachable' });
  });

  it('타임아웃 시 down', async () => {
    const never = () => new Promise<never>(() => undefined);
    const result = await probeDependency(never, 20);
    expect(result).toMatchObject({ status: 'down', message: 'timeout after 20ms' });
  });
});
