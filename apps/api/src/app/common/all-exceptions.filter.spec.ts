import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function mockHost(url = '/api/test') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('preserves an HttpException status and message', () => {
    const { host, status, json } = mockHost('/api/auth/login');

    filter.catch(new BadRequestException('bad input'), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'Bad Request',
        message: 'bad input',
        path: '/api/auth/login',
      }),
    );
  });

  it('maps an unknown error to a generic 500 without leaking details', () => {
    const { host, status, json } = mockHost();

    filter.catch(new Error('secret stack detail'), host);

    expect(status).toHaveBeenCalledWith(500);
    const body = json.mock.calls[0][0];
    expect(body).toMatchObject({
      statusCode: 500,
      message: 'Internal server error',
      error: 'InternalServerError',
    });
    expect(JSON.stringify(body)).not.toContain('secret stack detail');
  });
});
