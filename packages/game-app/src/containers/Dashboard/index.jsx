import { Box, Typography, Container, Divider } from "@mui/material";
import { Breadcrumbs, ListGames, ListPlayers } from "@/components";
// TODO: merge ListGames and ListPlayers into a ListResource component

const DashboardBox = ({ children }) => (
  <Box sx={{ width: "100%", pl: "1rem", pr: "1rem" }}>{children}</Box>
);

const Dashboard = () => {
  return (
    <div>
      <Breadcrumbs />
      <Typography variant="h1">Dashboard</Typography>
      <Container>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <DashboardBox>
            <ListGames variant="active" />
            <Divider />
            <ListGames variant="recent" />
          </DashboardBox>
          <Divider orientation="vertical" flexItem />
          <DashboardBox>
            <ListPlayers />
          </DashboardBox>
        </Box>
      </Container>
    </div>
  );
};

export default Dashboard;
