import { Link as RouterLink } from "react-router-dom";
import MuiLink from "@mui/material/Link";

const Link = (props = {}) => (
  <MuiLink {...props} underline="hover" color="inherit" component={RouterLink}>
    {props.children}
  </MuiLink>
);

export default Link;
