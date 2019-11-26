import swaggerToTS, { Options } from '../src';

describe('swaggerToTS', () => {
  it('is able to parse a Swagger 2 spec', () => {
    const spec = { definitions: {} };
    const options: Options = { swagger: 2 };

    expect(swaggerToTS(spec, options)).toBe('declare namespace OpenAPI2 {}\n');
  });

  it('is able to parse a Swagger 3 spec', () => {
    const spec = { components: { schemas: {} } };
    const options: Options = { swagger: 3 };

    expect(swaggerToTS(spec, options)).toBe('declare namespace OpenAPI3 {}\n');
  });

  it('errs on other options', () => {
    const spec = { definitions: {} };
    const options: Options = { swagger: 1 };
    expect(() => swaggerToTS(spec, options)).toThrowError();
  });

  it('should not render a wrapper when passing false', () => {
    const spec = { definitions: {} };
    const options: Options = { swagger: 2, wrapper: false };
    expect(swaggerToTS(spec, options)).toBe('');
  });
});
