import { useState } from "react";
import { useParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import SaveIcon from "@mui/icons-material/Save";

import { createPlayer } from "@/utils/api";

const PlayerRegistration = () => {
  const { playerId } = useParams();
  const [formData, formDataSet] = useState({ alias: "" });
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createPlayer,
    onSuccess: (data) => {
      queryClient.setQueryData(["player", playerId], data);
    },
  });

  const handleFormChange = (key) => (event) =>
    formDataSet({ ...formData, [key]: event.target.value });

  const handleSubmit = (event) => {
    event.preventDefault();
    mutation.mutate({ ...formData, fobId: playerId });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ border: "1px solid black", borderRadius: "10px", p: 3 }}
    >
      <Typography variant="h2">Registration</Typography>
      <Typography variant="body1">
        Please provide an alias so we know who you are
      </Typography>
      <TextField
        sx={{ display: "block" }}
        fullWidth
        label="Alias"
        variant="standard"
        onChange={handleFormChange("alias")}
        value={formData.alias}
      />
      <Button
        loading={mutation.isPending}
        type="submit"
        variant="contained"
        startIcon={<SaveIcon />}
        sx={{ mt: 2 }}
      >
        Submit
      </Button>
    </Box>
  );
};

export default PlayerRegistration;
