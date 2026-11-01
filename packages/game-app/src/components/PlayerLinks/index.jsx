import { Fragment } from "react";
import Box from "@mui/material/Box";

import { Link } from "@/components";
import { routes } from "@/utils/routes";

// "ann & bob", each name linking to the player page. `strong` marks winners.
const PlayerLinks = ({ players = [], strong = false, separator = " & " }) => (
  <Box component="span" sx={{ fontWeight: strong ? 700 : "inherit" }}>
    {players.map(({ id, alias }, i) => (
      <Fragment key={id}>
        {i ? separator : null}
        <Link to={routes.player(id)}>{alias}</Link>
      </Fragment>
    ))}
  </Box>
);

export default PlayerLinks;
