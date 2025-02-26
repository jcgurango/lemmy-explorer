import React from "react";

import useQueryCache from "../hooks/useQueryCache";

import Container from "@mui/joy/Container";

import Select, { selectClasses } from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Input from "@mui/joy/Input";
import Grid from "@mui/joy/Grid";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Typography from "@mui/joy/Typography";

import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import SortIcon from "@mui/icons-material/Sort";

import InstanceCard from "../components/InstanceCard";
import Pagination from "../components/Pagination";
import LanguageFilter from "../components/LanguageFilter";
import { PageLoading, PageError } from "../components/Display";

import useStorage from "../hooks/useStorage";

export default function Instances() {
  const [orderBy, setOrderBy] = useStorage("instance.orderBy", "smart");
  const [showOpenOnly, setShowOpenOnly] = useStorage("instance.showOpenOnly", false);

  const [pageLimit, setPagelimit] = useStorage("instance.pageLimit", 100);
  const [page, setPage] = React.useState(0);

  const [filterText, setFilterText] = useStorage("instance.filterText", "");
  const [filterLangCodes, setFilterLangCodes] = useStorage("community.filterLangCodes", []);

  const { isLoading, isSuccess, isError, error, data } = useQueryCache("instanceData", "/instances.json");

  const [totalFiltered, setTotalFiltered] = React.useState(0);
  const [instancesData, setInstancesData] = React.useState([]);

  const [processingData, setProcessingData] = React.useState(true);

  React.useEffect(() => {
    // process data
    setProcessingData(true);

    if (!data) return;
    if (error) return;

    // process data

    let instances = data;
    if (showOpenOnly) {
      instances = instances.filter((instance) => instance.open);
    }

    if (filterText) {
      instances = instances.filter((instance) => {
        if (instance.name && instance.name.toLowerCase().includes(filterText.toLowerCase())) return true;
        if (instance.desc && instance.desc.toLowerCase().includes(filterText.toLowerCase())) return true;
        if (instance.url && instance.url.toLowerCase().includes(filterText.toLowerCase())) return true;
        return false;
      });
    }

    // filter lang codes
    if (filterLangCodes.length > 0) {
      console.log(`Filtering instances by ${filterLangCodes}`);

      // filterLangCodes is [{code: "en"}, {code: "fr"}]
      // community.langs is ["en", "de"]
      instances = instances.filter((instance) => {
        const instanceLangs = instance.langs || [];
        const onlyShowLangs = filterLangCodes.map((lang) => lang.code);

        // if every of the filterLangCodes are specifically in the instanceLangCodes, return true
        return onlyShowLangs.every((lang) => instanceLangs.includes(lang)); // could add || instanceLangs[0] == "all" to show sites that have ever language enabled

        // remove non-matching
        return false;
      });
    }

    if (orderBy === "smart") {
      instances = instances.sort((a, b) => b.score - a.score);
    } else if (orderBy === "users") {
      instances = instances.sort((a, b) => b.usage.users.total - a.usage.users.total);
    } else if (orderBy === "active") {
      instances = instances.sort((a, b) => b.usage.users.activeMonth - a.usage.users.activeMonth);
    } else if (orderBy === "posts") {
      instances = instances.sort((a, b) => b.usage.localPosts - a.usage.localPosts);
    } else if (orderBy === "comments") {
      instances = instances.sort((a, b) => b.usage.localComments - a.usage.localComments);
    } else if (orderBy === "oldest") {
      instances = instances.sort((a, b) => {
        // timestamps are like 2023-06-14 02:30:32
        // we need to sort the array by the oldest uptime date
        // if there's no date on the record, it should go to the bottom of the list
        if (!a.uptime) return 1;
        if (!b.uptime) return -1;

        const aDate = new Date(a.uptime.date_created);
        const bDate = new Date(b.uptime.date_created);

        if (aDate < bDate) return -1;
        if (aDate > bDate) return 1;
        return 0;
      });
    }

    // pagination
    setTotalFiltered(instances.length);
    instances = instances.slice(page * pageLimit, (page + 1) * pageLimit);
    setInstancesData(instances);

    setProcessingData(false);
  }, [data, orderBy, showOpenOnly, filterText, page, pageLimit, filterLangCodes]);

  return (
    <Container maxWidth={false} sx={{}}>
      <Box
        component="header"
        sx={{
          p: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Input
          placeholder="Filter Instances"
          value={filterText}
          sx={{
            width: { xs: "100%", sm: 240 },
            flexShrink: 0,
          }}
          onChange={(event) => setFilterText(event.target.value)}
        />

        <Select
          placeholder="Order By"
          startDecorator={<SortIcon />}
          indicator={<KeyboardArrowDown />}
          value={orderBy}
          onChange={(event, newValue) => {
            setOrderBy(newValue);
          }}
          sx={{
            minWidth: 120,
            width: { xs: "100%", sm: 240 },
            flexShrink: 0,
            [`& .${selectClasses.indicator}`]: {
              transition: "0.2s",
              [`&.${selectClasses.expanded}`]: {
                transform: "rotate(-180deg)",
              },
            },
          }}
        >
          <Option value="smart">Smart Sort</Option>
          <Option value="users">Users</Option>
          <Option value="active">Active Users</Option>
          <Option value="posts">Posts</Option>
          <Option value="comments">Comments</Option>
          <Option value="oldest">Oldest</Option>
        </Select>

        <LanguageFilter
          languageCodes={filterLangCodes}
          setLanguageCodes={(codes) => setFilterLangCodes(codes)}
        />

        <Box sx={{ display: "flex", gap: 3 }}>
          <Checkbox
            label="Open Only"
            checked={showOpenOnly}
            onChange={(event) => setShowOpenOnly(event.target.checked)}
          />
        </Box>
        <Box
          sx={{
            display: "flex",
            flexGrow: 1,
            justifyContent: { xs: "center", sm: "flex-end" },
            alignItems: "center",
          }}
        >
          <Pagination
            page={page}
            count={totalFiltered}
            setPage={(value) => setPage(value)}
            limit={pageLimit}
          />
        </Box>
      </Box>

      <Box sx={{ my: 4 }}>
        {(isLoading || (processingData && !isError)) && <PageLoading />}
        {isError && <PageError error={error} />}

        {isSuccess && !processingData && (
          <Grid container spacing={2}>
            {instancesData.map((instance) => (
              <InstanceCard instance={instance} />
            ))}
          </Grid>
        )}
      </Box>
    </Container>
  );
}
