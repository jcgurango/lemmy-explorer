import React from "react";

import axios from "axios";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import Container from "@mui/joy/Container";

import Select, { selectClasses } from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";

// import Pagination from "@mui/material/Pagination";
import Input from "@mui/joy/Input";
import Autocomplete from "@mui/joy/Autocomplete";

import Grid from "@mui/joy/Grid";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Tabs from "@mui/joy/Tabs";
import TabList from "@mui/joy/TabList";
import Tab from "@mui/joy/Tab";

import Chip from "@mui/joy/Chip";
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";

import { useColorScheme } from "@mui/joy/styles";

import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";

import SortIcon from "@mui/icons-material/Sort";

import InstanceCard from "../components/InstanceCard";
import Pagination from "../components/Pagination";

import useStorage from "../hooks/useStorage";

export default function Instances() {
  const [orderBy, setOrderBy] = useStorage("instance.orderBy", "users");
  const [showOpenOnly, setShowOpenOnly] = useStorage("instance.showOpenOnly", false);

  const [pageLimit, setPagelimit] = useStorage("instance.pageLimit", 100);
  const [page, setPage] = React.useState(0);

  const [filterText, setFilterText] = useStorage("instance.filterText", "");

  const { isLoading, error, data, isFetching } = useQuery({
    queryKey: ["instanceData"],
    queryFn: () =>
      axios.get("/instances.json").then((res) => {
        return res.data;
      }),
    refetchOnWindowFocus: false,
  });

  const [totalFiltered, setTotalFiltered] = React.useState(0);
  const [instancesData, setInstancesData] = React.useState([]);

  React.useEffect(() => {
    // process data

    if (!data) return;

    // process data

    let instances = data;
    if (showOpenOnly) {
      instances = instances.filter((instance) => instance.open);
    }

    if (orderBy === "users") {
      instances = instances.sort((a, b) => b.usage.users.total - a.usage.users.total);
    } else if (orderBy === "active") {
      instances = instances.sort((a, b) => b.usage.users.activeMonth - a.usage.users.activeMonth);
    } else if (orderBy === "posts") {
      instances = instances.sort((a, b) => b.usage.localPosts - a.usage.localPosts);
    } else if (orderBy === "comments") {
      instances = instances.sort((a, b) => b.usage.localComments - a.usage.localComments);
    }

    if (filterText) {
      instances = instances.filter((instance) => {
        if (instance.name && instance.name.toLowerCase().includes(filterText.toLowerCase())) return true;
        if (instance.desc && instance.desc.toLowerCase().includes(filterText.toLowerCase())) return true;
        if (instance.url && instance.url.toLowerCase().includes(filterText.toLowerCase())) return true;
        return false;
      });
    }

    // pagination
    setTotalFiltered(instances.length);
    instances = instances.slice(page * pageLimit, (page + 1) * pageLimit);
    setInstancesData(instances);
  }, [data, orderBy, showOpenOnly, filterText, page, pageLimit]);

  if (isLoading) return "Loading...";
  if (error) return "An error has occurred: " + error.message;

  return (
    <Container maxWidth={false} sx={{}}>
      <Box
        component="header"
        sx={{
          p: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Input
          placeholder="Filter Instances"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
        />
        <Typography fontWeight="lg">
          <Select
            placeholder="Order By"
            startDecorator={<SortIcon />}
            indicator={<KeyboardArrowDown />}
            value={orderBy}
            onChange={(event, newValue) => {
              setOrderBy(newValue);
            }}
            sx={{
              width: 240,
              [`& .${selectClasses.indicator}`]: {
                transition: "0.2s",
                [`&.${selectClasses.expanded}`]: {
                  transform: "rotate(-180deg)",
                },
              },
            }}
          >
            <Option value="users">Users</Option>
            <Option value="active">Active Users</Option>
            <Option value="posts">Posts</Option>
            <Option value="comments">Comments</Option>
          </Select>
        </Typography>
        <Box sx={{ display: "flex", gap: 3 }}>
          <Checkbox
            label="Open Only"
            checked={showOpenOnly}
            onChange={(event) => setShowOpenOnly(event.target.checked)}
          />
        </Box>
        <Box sx={{ display: "flex", flexGrow: 1, justifyContent: "flex-end", alignItems: "center" }}>
          <Pagination
            page={page}
            count={totalFiltered}
            setPage={(value) => setPage(value)}
            limit={pageLimit}
          />
        </Box>
      </Box>

      <ReactQueryDevtools initialIsOpen={false} />
      <Box sx={{ my: 4 }}>
        <div>{isFetching ? "Updating..." : ""}</div>

        <Grid container spacing={2}>
          {instancesData.map((instance) => (
            <InstanceCard instance={instance} />
          ))}
        </Grid>
      </Box>
    </Container>
  );
}
