const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'eu-central-1';

interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken: string;
}

interface CognitoAuthResult {
  tokens: CognitoTokens;
  challengeName?: string;
  session?: string;
}

// SRP auth is complex — use Cognito InitiateAuth with USER_PASSWORD_AUTH instead
// This requires enabling USER_PASSWORD_AUTH flow on the Cognito App Client

export async function cognitoLogin(
  _userPoolId: string,
  clientId: string,
  email: string,
  password: string,
): Promise<CognitoAuthResult> {
  const response = await fetch(
    `https://cognito-idp.${AWS_REGION}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }),
    },
  );

  const data = await response.json();

  if (data.__type?.includes('NotAuthorizedException')) {
    throw new Error('Nieprawidlowy email lub haslo');
  }
  if (data.__type?.includes('UserNotFoundException')) {
    throw new Error('Uzytkownik nie istnieje');
  }
  if (data.__type?.includes('UserNotConfirmedException')) {
    throw new Error('Konto nie zostalo potwierdzone');
  }
  if (data.__type) {
    throw new Error(data.message || data.__type);
  }

  // Handle NEW_PASSWORD_REQUIRED challenge
  if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    return {
      tokens: { idToken: '', accessToken: '', refreshToken: '' },
      challengeName: 'NEW_PASSWORD_REQUIRED',
      session: data.Session,
    };
  }

  if (!data.AuthenticationResult) {
    throw new Error('Nieoczekiwana odpowiedz z serwera autoryzacji');
  }

  return {
    tokens: {
      idToken: data.AuthenticationResult.IdToken,
      accessToken: data.AuthenticationResult.AccessToken,
      refreshToken: data.AuthenticationResult.RefreshToken,
    },
  };
}

export async function cognitoRespondNewPassword(
  clientId: string,
  email: string,
  newPassword: string,
  session: string,
): Promise<CognitoAuthResult> {
  const response = await fetch(
    `https://cognito-idp.${AWS_REGION}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
      },
      body: JSON.stringify({
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: clientId,
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          NEW_PASSWORD: newPassword,
        },
      }),
    },
  );

  const data = await response.json();

  if (data.__type) {
    throw new Error(data.message || data.__type);
  }

  return {
    tokens: {
      idToken: data.AuthenticationResult.IdToken,
      accessToken: data.AuthenticationResult.AccessToken,
      refreshToken: data.AuthenticationResult.RefreshToken,
    },
  };
}

export function parseJwt(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(base64));
}
