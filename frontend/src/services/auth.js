import React, { createContext, useContext, useState, useEffect } from 'react';
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';

const POOL_DATA = {
  UserPoolId: process.env.REACT_APP_COGNITO_USER_POOL_ID,
  ClientId: process.env.REACT_APP_COGNITO_CLIENT_ID
};

const userPool = new CognitoUserPool(POOL_DATA);

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.getSession((err, session) => {
          if (err || !session.isValid()) {
            setIsAuthenticated(false);
            setUser(null);
          } else {
            setIsAuthenticated(true);
            cognitoUser.getUserAttributes((err, attributes) => {
              if (!err) {
                const userData = {};
                attributes.forEach(attr => {
                  userData[attr.Name] = attr.Value;
                });
                setUser(userData);
              }
            });
          }
          setLoading(false);
        });
      } else {
        setIsAuthenticated(false);
        setUser(null);
        setLoading(false);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setUser(null);
      setLoading(false);
    }
  }

  async function signIn(email, password) {
    return new Promise((resolve, reject) => {
      const authenticationDetails = new AuthenticationDetails({
        Username: email,
        Password: password
      });

      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          setIsAuthenticated(true);
          cognitoUser.getUserAttributes((err, attributes) => {
            if (!err) {
              const userData = {};
              attributes.forEach(attr => {
                userData[attr.Name] = attr.Value;
              });
              setUser(userData);
            }
          });
          resolve(result);
        },
        onFailure: (err) => {
          reject(err);
        }
      });
    });
  }

  async function signUp(email, password, name) {
    return new Promise((resolve, reject) => {
      const attributeList = [];
      if (name) {
        attributeList.push({
          Name: 'name',
          Value: name
        });
      }

      userPool.signUp(email, password, attributeList, null, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async function confirmSignUp(email, code) {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: email,
        Pool: userPool
      });

      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  async function signOut() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }
    setIsAuthenticated(false);
    setUser(null);
  }

  function getToken() {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (cognitoUser) {
        cognitoUser.getSession((err, session) => {
          if (err || !session.isValid()) {
            reject(err);
          } else {
            resolve(session.getIdToken().getJwtToken());
          }
        });
      } else {
        reject(new Error('No user'));
      }
    });
  }

  const value = {
    isAuthenticated,
    user,
    loading,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    getToken
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

