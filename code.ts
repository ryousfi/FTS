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
let filePath = 'src/assets/tokens/uds-variables.json';

// add switch case mode
if (figma.root.name.includes('UBS Icon Library')) {
  console.log('FTS - Icons sync mode detected');
  mode = 'icons';
} else if (figma.root.name.includes('UDS Styles & Variables')  || figma.root.name.includes('UBS Color Library')) {
  console.log('FTS - Tokens sync mode detected');
  mode = 'tokens';

  figma.root.name.includes('UDS Styles & Variables') ? filePath = 'src/assets/tokens/uds-variables.json' : filePath = 'figma-variables/ubs-colors.json';
} else {
  console.log('FTS - Modes sync mode detected');
  mode = 'modes';
}

figma.ui.postMessage({ type: 'mode', data: mode });


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
    const collections = [];
    const processedCollectionNames = new Set<string>();
    const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
    for (const collection of localCollections) {
      console.log('FTS - Processing collection: ' + collection.name);

      const ALLOWED_COLLECTIONS = ['Typography', 'Spacing', 'Border', 'UBS Theme', 'NOVA PB (WIP)', 'IB Theme', 'Component Web App 2.0 (WIP)'];
      if (!ALLOWED_COLLECTIONS.includes(collection.name)) {
        console.log('FTS - Skipping collection: ' + collection.name);
        continue;
      }
      if (processedCollectionNames.has(collection.name)) {
        console.log('FTS - Duplicate collection skipped: ' + collection.name);
        continue;
      }
      processedCollectionNames.add(collection.name);
      collections.push(await processCollection(collection));
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
 * Process a Figma variable collection
 */
async function processCollection({ name, modes, variableIds }) {

  const collectionDate = {
    name,
    modes: [],
  }

  // Cache variable collection lookups to avoid redundant async calls when
  // remote/published collections use a different modeId format than valuesByMode keys.
  const varCollectionCache = new Map<string, any>();

  for (const mode of modes) {

    console.log('Mode: ' + mode.name)
    const modeData = {
      name: mode.name,
      variables: []
    }
    for (const variableId of variableIds) {
      let variableData = {
      }

      let isAlias = false;

      const { name, resolvedType, valuesByMode, variableCollectionId } =
        await figma.variables.getVariableByIdAsync(variableId);

      // Skip mobile specific variables
      if (name.includes('-mobile')) continue;

      // For remote/published library collections the collection's modeId
      // format (e.g. "VariableCollectionId:x/y") differs from the short
      // numeric keys in valuesByMode. Fall back to matching by mode name.
      let modeIdToUse = mode.modeId;
      if (valuesByMode[modeIdToUse] === undefined) {
        if (!varCollectionCache.has(variableCollectionId)) {
          varCollectionCache.set(
            variableCollectionId,
            await figma.variables.getVariableCollectionByIdAsync(variableCollectionId)
          );
        }
        const varCol = varCollectionCache.get(variableCollectionId);
        const match = varCol?.modes.find((m: any) => m.name === mode.name);
        if (match) modeIdToUse = match.modeId;
      }

      const value: any = valuesByMode[modeIdToUse];
      // if (value !== undefined && ["COLOR", "FLOAT"].includes(resolvedType)) {

      // TODO check this part
      let obj: any = {};
      name.split("/").forEach((groupName) => {
        obj[groupName] = obj[groupName] || {};
        obj = obj[groupName];
      });
      // TODO change type to string, color, number and boolean
      //   obj.$type = resolvedType === "COLOR" ? "color" : "number";
      let convertedType = '';
      switch (resolvedType) {
        case 'COLOR':
          convertedType = 'color';
          break;

        case 'FLOAT':
          convertedType = 'number';

          break;

        case 'STRING':
          convertedType = 'string';

          break;

        case 'BOOLEAN':
          convertedType = 'boolean';

          break;

        default:
          break;
      }
      // Guard: a variable may not have a value defined for every mode
      // (e.g. if the mode was added after the variable was created).
      if (value === undefined || value === null) {
        console.log(`WARN - No value defined for mode "${mode.name}" (${mode.modeId}) in variable "${name}" — skipping`);
        continue;
      }
      if (value.type === "VARIABLE_ALIAS") {
        isAlias = true;
        const currentVar = await figma.variables.getVariableByIdAsync(
          value.id
        );

        const currentCol = await figma.variables.getVariableCollectionByIdAsync(
          currentVar.variableCollectionId
        );

        obj.$value = {
          collection: currentCol.name,
          name: currentVar.name

        }
      } else {
        obj.$value = resolvedType === "COLOR" ? rgbToHex(value) : value;
      }


      variableData = {
        name,
        type: convertedType,
        isAlias,
        value: obj.$value
      }


      modeData.variables.push(variableData)
      //  }
    }
    collectionDate.modes.push(modeData)

  }
  return collectionDate;
}

/**
 * Convert Figma RGB color to hex or rgba string
 */
function rgbToHex({ r, g, b, a }) {
  if (a !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${a.toFixed(4)})`;
  }
  const toHex = (value) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}
