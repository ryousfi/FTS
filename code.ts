const URL_BASE = '<URL>';
const SYNC_ENDPOINT = URL_BASE + 'update-uwr/';
const ICONS_SYNC_ENDPOINT = URL_BASE + 'update-uwr-icons/';

// Show the initial UI without text messages
console.log('FTS - Init the plugin UI ...');
figma.showUI(__html__, {
  width: 1020,
  height: 800
});

// Check whether to sync tokens or icons
let mode: 'tokens' | 'icons' | 'modes';
let componentWebAppCollection = null;
let filePath = 'packages/themes/src/tokens/tokens.json';

// add switch case mode
if (figma.root.name.includes('UBS Icon Library')) {
  console.log('FTS - Icons sync mode detected');
  mode = 'icons';
} else if (figma.root.name.includes('UDS Styles & Variables')  || figma.root.name.includes('UBS Color Library')) {
  console.log('FTS - Tokens sync mode detected');
  mode = 'tokens';

  figma.root.name.includes('UDS Styles & Variables') ? filePath = 'packages/themes/src/tokens/tokens.json' : filePath = 'packages/themes/src/tokens/primitive-colors.json';
} else {
  console.log('FTS - Modes sync mode detected');
  mode = 'modes';
}

const fileName = figma.root.name;
figma.ui.postMessage({ type: 'mode', data: { mode, fileName } });


if (mode === 'icons') {
  console.log('FTS - Extracting svgs ...');
  (async () => {
    await figma.loadAllPagesAsync();
    const icons = [];
    // get all frames in the page names "Icons"
    const page = figma.root.children.find((page) => page.name === 'Icons');

    // loop over page children, get childs with name "24 px", "12px" and "16px"
    page.children.forEach((child) => {
      if (child.name === '24px' || child.name === '12px' || child.name === '16px') {
        traverse(child, icons);
      }
    });

    const svgs = [];
    // Loop overs the nodes and get the icon content for each one
    icons.forEach(async (icon) => {
      const iconsContent = await getIconContent(icon.node.id)
      svgs.push({ name: icon.name, content: iconsContent })
    })

    console.log('FTS - Render SVGs ...');
    setTimeout(() => {
      figma.ui.postMessage({ type: 'svgs', data: svgs });
    }, 1000);


  })()

} else if (mode === 'tokens') {
  // Extract collections and variables and send a notification to figma UI
  console.log('FTS - Extracting collections and variables ...');
  (async () => {
    const ALLOWED_COLLECTIONS = ['Typography', 'Spacing', 'Border', 'UBS Theme', 'NOVA PB', 'NOVA WM', 'IB Theme (WIP)', 'Component Web App 2.0 (WIP)', 'Primitive UBS Color Tokens'];

    const collections = [];
    const processedCollectionNames = new Set<string>();
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();

    // collection.variableIds is unreliable for extended collections (it returns the
    // parent collection's variables). Build real ownership ourselves, while keeping
    // the user-defined display order from the source collection's variableIds.
    const allLocalVars = await figma.variables.getLocalVariablesAsync();
    const varById = new Map<string, any>();
    for (const v of allLocalVars) varById.set(v.id, v);
    const ownedByCollection = new Map<string, any[]>();
    for (const c of localCollections) {
      const ordered: any[] = [];
      for (const vid of c.variableIds) {
        const v = varById.get(vid);
        if (v && v.variableCollectionId === c.id) ordered.push(v);
      }
      if (ordered.length > 0) ownedByCollection.set(c.id, ordered);
    }

    // Index every modeId -> owning collection so we can walk parentModeId chains
    // from an extended collection up to the source collection that owns the variables.
    const collectionByModeId = new Map<string, any>();
    for (const c of localCollections) {
      for (const m of c.modes) collectionByModeId.set(m.modeId, c);
    }

    const findSourceCollection = (extended: any): any | null => {
      let modeId: string | undefined = extended.modes[0]?.parentModeId;
      const seen = new Set<string>();
      while (modeId && !seen.has(modeId)) {
        seen.add(modeId);
        const c = collectionByModeId.get(modeId);
        if (!c) return null;
        if ((ownedByCollection.get(c.id) || []).length > 0) return c;
        const m = c.modes.find((mm: any) => mm.modeId === modeId);
        modeId = m?.parentModeId;
      }
      return null;
    };

    for (const collection of localCollections) {
      if (!ALLOWED_COLLECTIONS.includes(collection.name)) continue;
      if (processedCollectionNames.has(collection.name)) {
        console.log('FTS - Duplicate collection skipped: ' + collection.name);
        continue;
      }
      processedCollectionNames.add(collection.name);
      console.log('FTS - Processing collection: ' + collection.name);

      const owned = ownedByCollection.get(collection.id) || [];
      if (owned.length > 0) {
        // Source collection — read variable.valuesByMode directly.
        collections.push(await processCollection(collection, owned, null));
        continue;
      }

      // Extended collection — variables live in the parent. Use the source's variables
      // and look up override+inherited values via valuesByModeForCollectionAsync.
      const source = findSourceCollection(collection);
      if (!source) {
        console.log(`FTS - Skipping "${collection.name}": no source collection found via parentModeId chain`);
        continue;
      }
      const sourceVars = ownedByCollection.get(source.id) || [];
      console.log(`FTS - "${collection.name}" extends "${source.name}" (${sourceVars.length} inherited vars)`);
      collections.push(await processCollection(collection, sourceVars, collection));
    }

    // Render text messages
    console.log('FTS - Render tokens ...');
    setTimeout(() => {
      figma.ui.postMessage({ type: 'tokens', data: collections });
    }, 1000);

  })()
} else {
  console.log('FTS - Modes apply mode detected');

  (async () => {
    await figma.loadAllPagesAsync();
    const WebAppCollectionModes = [];
    let WebAppCollectioncurrentMode = {};

    if (figma.currentPage.selection.length > 0) {


      // setExplicitVariableModeForCollection

      // Use only on the selected nodes
      for (const node of figma.currentPage.selection) {
        // get the modes applied to the node
        console.log('One selected node: ' + node.name);
        console.log('resolved mode: ' + JSON.stringify(node.explicitVariableModes));
        //console.log('explicit variable mode: ' + node.explicitVariableModes);

        // get the collectionId key and and its value modeId from an object of this type: { [collectionId: string]: string }
        // check if the node uses the collection 'Component Web App'
        // iterate over the keys of the object
        if (Object.keys(node.explicitVariableModes).length === 0) {
          console.log('WARN - No explicit variable modes set for this node');
        } else {
          // iterte over the keys of the object
          Object.keys(node.explicitVariableModes).forEach((collectionId) => {



            // get the collection name
            figma.variables.getVariableCollectionByIdAsync(collectionId).then((collection) => {
              if (collection.name === 'Component Web App') {

                // FOUND THE COLLECTION
                console.log('Found Collection: ' + collection.name);
                componentWebAppCollection = collection;
                const selectedModeId = node.explicitVariableModes[collectionId];

                // get all avilable modes within the collection
                collection.modes.forEach((mode) => {
                  console.log('Found Modes: ' + mode.name + ' - ' + mode.modeId);
                  WebAppCollectionModes.push({
                    name: mode.name,
                    modeId: mode.modeId
                  });

                  if (mode.modeId === selectedModeId) {
                    console.log('Current mode name: ' + mode.name);
                    WebAppCollectioncurrentMode = {
                      name: mode.name,
                      modeId: mode.modeId
                    };
                  }

                })
              }

            });
          })

        }

        // set the explicit variable mode for the collection
        //  node.setExplicitVariableModeForCollection(collection, '3:0');

      }

    }



    console.log('FTS - Render modes ...');
    setTimeout(() => {
      figma.ui.postMessage({
        type: 'modes', data: {
          collectionModes: WebAppCollectionModes,
          currentMode: WebAppCollectioncurrentMode
        }
      });
    }, 1000);


  })()


}

/**
 * Recrsively traverse the Figma page tree and return all vector based nodes
 *
 * @param node : current node
 * @param icons : icons list
 */
function traverse(node: any, icons: any[]) {
  if ("children" in node) {
    for (const child of node.children) {
      if (child.type === "COMPONENT") {
        // get first child of the component
        const componentChild = child.children[0];
        if (componentChild.type === "VECTOR") {
          icons.push({ name: toCamelCase(child.name), node: componentChild });
        }
      } else {
        traverse(child, icons)
      }
    }
  }
}

/**
 * Convert a hyphenated string to camel case
 * @param name : the name of the variable
 * @returns the camel case version of the input string
 */
function toCamelCase(name: string) {
  return name.replace(/-./g, match => match.charAt(1).toUpperCase());
}


/**
 * Retrieve the svg string for the given node ID
 *
 * @param nodeId the id of the vector node
 * @returns svg string
 */
async function getIconContent(nodeId: string) {
  const node: any = await figma.getNodeByIdAsync(nodeId)
  const content = await node.exportAsync({ format: 'SVG_STRING' })
  
  return content;
}


/**
 * Handle messages from the Figma UI
 */
figma.ui.onmessage = (msg: { type: string, data: any }) => {
  if (msg.type === 'create_mr') {
    console.log('FTS - Sending the MR creation request to GENE ...');

    const fileContent = {
      version: "1.0.0",
      metadata: {},
      collections: []
    }

    msg.data.forEach(collection => fileContent.collections.push(collection));

    const requestParams = {
      file_path: filePath,
      content: JSON.stringify(fileContent)
    }
    console.log(requestParams);

    // print formatted JSON
    console.log('FTS - Request params: ' + JSON.stringify(requestParams, null, 2));

    (async () => {
      try {
        const data = await fetchWithErrorHandling(SYNC_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(
              requestParams
            ),
          });
        figma.ui.postMessage({ type: 'mr_creation', code: 'success', data });
      } catch (error) {
        console.log('FTS - Error occured while synchronizing tokens to github: ' + (error as Error).message);
        figma.ui.postMessage({ type: 'mr_creation', code: 'failure', data: (error as Error).message });
      }
    })();


    /* setTimeout(() =>{
       const data = {
         merge_request_link: 'https://www.google.com/'
       }  
       figma.ui.postMessage({ type: 'mr_creation', code: 'success', data });
     // figma.ui.postMessage({ type: 'mr_creation', code: 'failure', data: 'What!!' });
     }, 2000)*/

  } else if (msg.type === 'create_mr_icons') {
    console.log('FTS - Sending the MR creation request to GENE ...');

    const requestParams = {
      //  content: JSON.stringify(msg.data)
      content: msg.data
    }
    console.log(requestParams);

    (async () => {
      try {
        const data = await fetchWithErrorHandling(ICONS_SYNC_ENDPOINT,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(
              requestParams
            ),
          });
        figma.ui.postMessage({ type: 'mr_creation', code: 'success', data });
      } catch (error) {
        console.log('FTS - Error occured while synchronizing resources to github: ' + (error as Error).message);
        figma.ui.postMessage({ type: 'mr_creation', code: 'failure', data: (error as Error).message });
      }
    })();


    /* setTimeout(() =>{
       const data = {
         merge_request_link: 'https://www.google.com/'
       }  
       figma.ui.postMessage({ type: 'mr_creation', code: 'success', data });
     // figma.ui.postMessage({ type: 'mr_creation', code: 'failure', data: 'What!!' });
     }, 2000)*/

  } else if (msg.type === 'apply_selected_mode') {
    console.log('FTS - Applying the selected mode: ' + msg.data.name);
    console.log('the collection ' +
       componentWebAppCollection +
        '  ' + figma.currentPage.selection.length
    )

    if (figma.currentPage.selection.length > 0 && componentWebAppCollection) {
console.log('there is selection')

      // setExplicitVariableModeForCollection

      // Use only on the selected nodes
      for (const node of figma.currentPage.selection) {

        console.log('taking the first node' +
           msg.data.id
        )
        node.setExplicitVariableModeForCollection(componentWebAppCollection, msg.data.modeId);
        console.log('FTS - Selected mode applied: ' + msg.data.name);
        figma.closePlugin();

      }
    }

  } else {
    figma.closePlugin();
  }
};

/**
 * Fetch with error handling
 */
async function fetchWithErrorHandling(url: any, options = {}) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:' + (error as Error).message);
    throw error;
  }
}


/**
 * Process a Figma variable collection.
 *
 * - `collection` is the collection being exported (source OR extended).
 * - `variables` is the list of source Variable objects whose values should be read.
 *   For a source collection that's its own variables; for an extended collection
 *   that's the variables of the source it inherits from.
 * - `extendedCollection` is non-null when `collection` is an extended collection.
 *   In that case we resolve per-mode values via
 *   variable.valuesByModeForCollectionAsync(extendedCollection), which returns
 *   the override (or inherited) value keyed by the extended collection's mode IDs.
 */
async function processCollection(collection: any, variables: any[], extendedCollection: any | null) {
  const collectionDate = {
    name: collection.name,
    modes: collection.modes.map((m: any) => ({ name: m.name, variables: [] as any[] })),
  };

  for (const variable of variables) {
    const { name, resolvedType } = variable;

    // Skip mobile-specific variables
    if (
      name.includes('-mobile') ||
      name.includes('mobile-') ||
      name.includes('-ios') ||
      name.includes('-android') ||
      name.includes('android-') ||
      name.includes('ios-')
    ) continue;

    // Resolve the values map once per variable.
    const valuesByMode: { [k: string]: any } = extendedCollection
      ? await variable.valuesByModeForCollectionAsync(extendedCollection)
      : variable.valuesByMode;

    for (let i = 0; i < collection.modes.length; i++) {
      const mode = collection.modes[i];
      const value: any = valuesByMode[mode.modeId];
      if (value === undefined || value === null) continue;

      let convertedType = '';
      switch (resolvedType) {
        case 'COLOR': convertedType = 'color'; break;
        case 'FLOAT': convertedType = 'number'; break;
        case 'STRING': convertedType = 'string'; break;
        case 'BOOLEAN': convertedType = 'boolean'; break;
      }

      let exportedValue: any;
      let isAlias = false;
      if (value.type === 'VARIABLE_ALIAS') {
        isAlias = true;
        const aliasVar = await figma.variables.getVariableByIdAsync(value.id);
        const aliasCol = await figma.variables.getVariableCollectionByIdAsync(aliasVar.variableCollectionId);
        exportedValue = {
          collection: aliasCol.name,
          name: aliasVar.name,
        };
      } else {
        exportedValue = resolvedType === 'COLOR' ? rgbToHex(value) : value;
      }

      collectionDate.modes[i].variables.push({
        name,
        type: convertedType,
        isAlias,
        value: exportedValue,
      });
    }
  }
  return collectionDate;
}

/**
 * Convert Figma RGB color to hex or rgba string
 */
function rgbToHex({ r, g, b, a }) {
  // Figma color values are RGB | RGBA — a is absent on colors with no alpha channel
  const alpha = a === undefined ? 1 : a;
  if (alpha !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${alpha.toFixed(4)})`;
  }
  const toHex = (value) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}
