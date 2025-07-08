export const LoginStart = (userCredentials) => ({
    type: "LOGIN_START"
})

export const LoginSuccess = (user) = ({
    type: "LOGIN_SUCCESS",
    payload: user,
    isLoggedIn: true
});

export const LoginFailure = () => ({
    type: "LOGIN_FAILURE",
})

export const Logout = () => ({
    type: "LOGOUT",
})

export const UpdateStart = (userCredentials) => ({
    type: "UPDATE_START"
})

export const UpdateSuccess = (user) = ({
    type: "UPDATE_SUCCESS",
    payload: user,
    isLoggedIn: true
});

export const UpdateFailure = () => ({
    type: "UPDATE_FAILURE",
})

export const AuthenticationSuccess = (user) => ({
    type: "Authentication_Success",
    payload: user,
    isLoggedIn: true,
})

export const AuthenticationFailure = () => ({
    type: "Authentication_Failure",
})