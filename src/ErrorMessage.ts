import { GithubError } from './GithubError';

export class ErrorMessage {
  private error: any;
  private githubErrors: GithubError[];

  constructor(error: any) {
    this.error = error;
    this.githubErrors = this.generateGithubErrors();
  }

  private generateGithubErrors(): GithubError[] {
    const errors = this.error.errors;
    if (errors instanceof Array) {
      return errors.map(err => new GithubError(err));
    } else {
      return [];
    }
  }

  get status(): number {
    return this.error.status;
  }

  hasErrorWithCode(code: string): boolean {
    return this.githubErrors.some(err => err.code == code);
  }

  toString(): string {
    const message = this.error.message;
    const errors = this.githubErrors;
    const status = this.status;
    if (errors.length > 0) {
      return `Error ${status}: ${message}\nErrors:\n${this.errorBulletedList(errors)}`;
    } else {
      return `Error ${status}: ${message}`;
    }
  }

  private errorBulletedList(errors: GithubError[]): string {
    return errors.map(err => `- ${err}`).join('\n');
  }
}
