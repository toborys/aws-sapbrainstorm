import type { PreSignUpTriggerEvent, PreSignUpTriggerHandler } from 'aws-lambda';

export const handler: PreSignUpTriggerHandler = async (event: PreSignUpTriggerEvent) => {
  try {
    console.log('Pre-signup trigger', JSON.stringify({ triggerSource: event.triggerSource, userName: event.userName }));

    // Block self-signup — only allow admin-created users
    if (event.triggerSource === 'PreSignUp_SignUp') {
      throw new Error('Self-signup is not allowed. Please contact your administrator.');
    }

    // Allow AdminCreateUser flow (PreSignUp_AdminCreateUser)
    // Auto-confirm if created by admin
    if (event.triggerSource === 'PreSignUp_AdminCreateUser') {
      event.response.autoConfirmUser = true;
      event.response.autoVerifyEmail = true;
    }

    return event;
  } catch (err) {
    console.error('pre-signup-trigger error', err);
    throw err;
  }
};
