const Reducer = (state, action) => {
  switch (action.type) {
    case "LOGIN_START":
      return {
        user: null,
        isLoggedIn: false,
        isFetching: true,
        error: false,
      };
      case "LOGIN_SUCCESS":
      return {
        user: action.payload,
        isLoggedIn: true,
        isFetching: false,
        error: false,
      };
      case "LOGIN_FAILURE":
      return {
        user: null,
        isLoggedIn: false,
        isFetching: false,
        error: true,
      };
      case "UPDATE_START":
      return {
        ...state,
        isLoggedIn: true,
        isFetching: true
      };
      case "UPDATE_SUCCESS":
      return {
        user: action.payload,
        isLoggedIn: true,
        isFetching: false,
        error: false,
      };
      case "UPDATE_FAILURE":
      return {
        user: state.user,
        isLoggedIn: false,
        isFetching: false,
        error: true,
      };
      case "LOGOUT":
      return {
        user: null,
        isLoggedIn: false,
        isFetching: false,
        error: false,
      };
      case "CUSTOM_UPDATE_START":
        return {
          user: null,
          isLoggedIn: false,
          isFetching: true,
          error: false,
        };
      case "CUSTOM_UPDATE_SUCCESS":
        return {
          user: action.payload,
          isLoggedIn: false,
          isFetching: false,
          error: false,
        };
        case "Authentication_Success":
        return{
          user: action.payload,
          isLoggedIn:true,
          isFetching: false,
          error: false,
        };
      case  "Authentication_Failure":
        return{
          user: null,
          isLoggedIn:false,
          isFetching: false,
          error: true,
        };  
      default:
          return state;
  }
};

export default Reducer;