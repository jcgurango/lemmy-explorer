// this file generates the .json files for the frontend /public folder
// it conencts to redis and pulls lists of all the data we have stored

import { open } from "node:fs/promises";
import { readFile } from "node:fs/promises";

import {
  listInstanceData,
  listCommunityData,
  listFediverseData,
  listFailureData,
  getLatestUptimeData,
} from "../lib/storage.js";

import { OUTPUT_MAX_AGE_MS } from "../lib/const.js";

export default class CrawlOutput {
  constructor() {
    this.storeData = [];
    this.storeCommunityData = [];
    this.storeFediverseData = [];
  }

  async start() {
    // get uptime data from crawl table
    const uptimeData = await getLatestUptimeData();
    function getBaseUrlUptime(baseUrl) {
      const foundKey = uptimeData.nodes.find((k) => k.domain == baseUrl);
      return foundKey;
    }
    console.log(`Uptime: ${uptimeData.nodes.length}`);

    ///
    /// Lemmy Instances
    ///

    let failureData = await listFailureData("instance");

    function findFail(baseUrl) {
      const keyName = `error:instance:${baseUrl}`;

      const value =
        failureData[Object.keys(failureData).find((k) => k === keyName)];

      if (value) {
        return value;
      }

      return null;
    }

    console.log(`Failures: ${Object.keys(failureData).length}`);
    console.log();

    const instances = await listInstanceData();

    // count instances by list
    let linkedFederation = {};
    let allowedFederation = {};
    let blockedFederation = {};
    function dedupAddItem(list, baseUrl) {
      // only add strings
      if (typeof baseUrl !== "string") {
        return;
      }

      if (!list[baseUrl]) {
        list[baseUrl] = 1;
      } else {
        list[baseUrl]++;
      }
    }
    instances.forEach((instance) => {
      // console.log(instance.siteData.federated);
      if (instance.siteData.federated) {
        const { linked, allowed, blocked } = instance.siteData.federated;
        if (linked.length > 0) {
          for (const baseUrl of linked) {
            dedupAddItem(linkedFederation, baseUrl);
          }
        }
        if (allowed && allowed.length > 0) {
          for (const baseUrl of allowed) {
            dedupAddItem(allowedFederation, baseUrl);
          }
        }
        if (blocked && blocked.length > 0) {
          for (const baseUrl of blocked) {
            dedupAddItem(blockedFederation, baseUrl);
          }
        }
      }
    });

    // console.log(`Instances: ${linkedInstanceListCount}`);

    let storeData = instances.map((instance) => {
      let siteBaseUrl = instance.siteData.site.actor_id.split("/")[2];

      const siteUptime = getBaseUrlUptime(siteBaseUrl);

      const incomingBlocks = blockedFederation[siteBaseUrl] || 0;
      const outgoingBlocks = instance.siteData.federated?.blocked?.length || 0;

      let score = 0;
      // having a linked instance gives you a point for each link
      if (linkedFederation[siteBaseUrl]) {
        score += linkedFederation[siteBaseUrl];
      }

      // each allowed instance gives you points
      if (allowedFederation[siteBaseUrl]) {
        score += allowedFederation[siteBaseUrl] * 2;
      }

      // each blocked instance takes away points
      if (blockedFederation[siteBaseUrl]) {
        score -= blockedFederation[siteBaseUrl] * 10;
      }

      return {
        baseurl: siteBaseUrl,
        url: instance.siteData.site.actor_id,
        name: instance.siteData.site.name,
        desc: instance.siteData.site.description,

        // config
        downvotes: instance.siteData.config?.enable_downvotes,
        nsfw: instance.siteData.config?.enable_nsfw,
        create_admin: instance.siteData.config?.community_creation_admin_only,
        private: instance.siteData.config?.private_instance,
        fed: instance.siteData.config?.federation_enabled,

        date: instance.siteData.site.published,
        version: instance.nodeData.software.version,
        open: instance.nodeData.openRegistrations,

        usage: instance.nodeData.usage, // TO BE DEPRECATED
        counts: instance.siteData.counts, // USE THIS INSTEAD

        icon: instance.siteData.site.icon,
        banner: instance.siteData.site.banner,
        langs: instance.langs,

        time: instance.lastCrawled || null,
        score: score,
        uptime: siteUptime,

        blocks: {
          incoming: incomingBlocks,
          outgoing: outgoingBlocks,
        },
      };
    });

    // remove those with errors that happened before time
    storeData = storeData.filter((instance) => {
      const fail = findFail(instance.baseurl);
      if (fail) {
        if (instance.time < fail.time) {
          // console.log("filtered due to fail", fail, instance.baseurl);
          return false;
        }
      }
      return true;
    });

    // remove instances not updated in 24h
    storeData = storeData.filter((instance) => {
      if (!instance.time) return false; // record needs time

      // remove communities with age more than the max
      const recordAge = Date.now() - instance.time;
      if (recordAge > OUTPUT_MAX_AGE_MS) {
        return false;
      }

      return true;
    });

    // filter blank
    storeData = storeData.filter(
      (instance) => instance.url !== "" || instance.name !== ""
    );

    console.log(`Instances ${instances.length} -> ${storeData.length}`);
    console.log();

    await this.writeJsonFile(
      "../frontend/public/instances.json",
      JSON.stringify(storeData)
    );

    ///
    /// Lemmy Communities
    ///

    const communities = await listCommunityData();

    let storeCommunityData = communities.map((community) => {
      let siteBaseUrl = community.community.actor_id.split("/")[2];

      let score = 0;
      // having a linked instance gives you a point for each link
      if (linkedFederation[siteBaseUrl]) {
        score += linkedFederation[siteBaseUrl];
      }

      // each allowed instance gives you points
      if (allowedFederation[siteBaseUrl]) {
        score += allowedFederation[siteBaseUrl] * 2;
      }

      // each blocked instance takes away points
      if (blockedFederation[siteBaseUrl]) {
        score -= blockedFederation[siteBaseUrl] * 10;
      }

      // also score based subscribers
      score = score * community.counts.subscribers;

      return {
        baseurl: siteBaseUrl,
        url: community.community.actor_id,
        name: community.community.name,
        title: community.community.title,
        desc: community.community.description,
        icon: community.community.icon,
        banner: community.community.banner,
        nsfw: community.community.nsfw,
        counts: community.counts,
        time: community.lastCrawled || null,
        score: score,
      };
    });

    // remove those with errors that happened before updated time
    storeCommunityData = storeCommunityData.filter((community) => {
      const fail = findFail(community.baseurl);
      if (fail) {
        if (community.time < fail.time) {
          // console.log("filtered due to fail", fail, instance.baseurl);
          return false;
        }
      }
      return true;
    });

    // remove communities not updated in 24h
    storeCommunityData = storeCommunityData.filter((community) => {
      if (!community.time) return false; // record needs time

      // remove communities with age more than the max
      const recordAge = Date.now() - community.time;
      if (recordAge > OUTPUT_MAX_AGE_MS) {
        return false;
      }

      return true;
    });

    // filter blank
    storeCommunityData = storeCommunityData.filter(
      (community) =>
        community.url !== "" || community.name !== "" || community.title !== ""
    );

    console.log(
      `Communities ${communities.length} -> ${storeCommunityData.length}`
    );
    console.log();

    await this.writeJsonFile(
      "../frontend/public/communities.json",
      JSON.stringify(storeCommunityData)
    );

    ///
    /// Fediverse Servers
    ///

    const fediverseData = await listFediverseData();
    // console.log("Fediverse", fediverseData);

    let returnStats = [];
    let storeFediverseData = Object.keys(fediverseData).forEach((fediKey) => {
      const fediverse = fediverseData[fediKey];
      // console.log("fediverseString", fediverseString);
      const baseUrl = fediKey.replace("fediverse:", "");
      // console.log("baseUrl", baseUrl);

      // const fediverse = JSON.parse(fediverseString);
      // console.log("fediverse", fediverse);
      if (fediverse.name) {
        returnStats.push({
          url: baseUrl,
          software: fediverse.name,
          version: fediverse.version,
        });
      }
    });
    console.log("Fediverse Servers", returnStats.length);

    await this.writeJsonFile(
      "../frontend/public/fediverse.json",
      JSON.stringify(returnStats)
    );

    const metaData = {
      instances: storeData.length,
      communities: storeCommunityData.length,
      fediverse: returnStats.length,
      time: Date.now(),
    };
    await this.writeJsonFile(
      "../frontend/public/meta.json",
      JSON.stringify(metaData)
    );

    // generate overview metrics and stats
    const metrics = {
      instances: storeData.length,
      communities: storeCommunityData.length,

      // top 10 linked, allowed, blocked domains
      // sort by count of times seen on each list
      linked: linkedFederation,
      allowed: allowedFederation,
      blocked: blockedFederation,

      // federation instance software/version
    };

    await this.writeJsonFile(
      "../frontend/public/overview.json",
      JSON.stringify(metrics)
    );
  }

  async writeJsonFile(filename, data) {
    let filehandle = null;
    try {
      filehandle = await open(filename, "w");
      await filehandle.writeFile(data);
    } finally {
      await filehandle?.close();
    }
  }
}
