import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok status', () => {
    const controller = new HealthController();
    expect(controller.check().status).toBe('ok');
  });
});
