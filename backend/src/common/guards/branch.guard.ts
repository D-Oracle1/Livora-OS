import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const BRANCH_SCOPE_KEY = 'branchScope';

/**
 * BranchGuard — enforces branch-level data isolation.
 *
 * BRANCH_MANAGER users can only see data for their own branch.
 * Admins and above see everything.
 * Attach with @UseBranchScope() decorator.
 */
@Injectable()
export class BranchGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) return true;

    const bypassRoles = ['SUPER_ADMIN', 'GENERAL_OVERSEER', 'ADMIN'];
    if (bypassRoles.includes(user.role)) return true;

    if (user.role === 'BRANCH_MANAGER') {
      const targetBranchId =
        req.params?.branchId ||
        req.query?.branchId ||
        req.body?.branchId;

      if (targetBranchId && targetBranchId !== user.branchId) {
        throw new ForbiddenException('You can only access data for your own branch');
      }

      // Inject branchId filter so services can scope queries automatically
      req.branchId = user.branchId;
    }

    return true;
  }
}
