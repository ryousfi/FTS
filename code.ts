const URL_BASE = 'https://my-app.cawbh.whs-at49357-dev-cx-b2e-nch.azpriv-cloud.ubs.net/api/';
const SYNC_ENDPOINT = URL_BASE + '/update-uwr/';
const ICONS_SYNC_ENDPOINT = URL_BASE + '/update-uwr-icons/';

// Show the initial UI without text messages
console.log('FTS - Init the plugin UI ...');
figma.showUI(__html__, {
  width: 1020,
  height: 800
});

// Check whether to sync tokens or icons
const mode: 'tokens' | 'icons' = figma.root.name.includes('UBS Icon Library') ? 'icons' : 'tokens';

console.log('FTS - Extraction mode detected: ' + mode);
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

    const svgs =[];
    // Loop overs the nodes and get the icon content for each one
    icons.forEach(async (icon) => {
      const iconsContent = await getIconContent(icon.node.id)
      svgs.push({name: icon.name, content: iconsContent})
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
  const localCollections = await figma.variables.getLocalVariableCollectionsAsync();

  for (const collection of localCollections) {
    collections.push(await processCollection(collection));
  }

  // Render text messages
  console.log('FTS - Render tokens ...');
  setTimeout(() => {
    figma.ui.postMessage({ type: 'tokens', data: collections });
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
          icons.push({name: toCamelCase(child.name), node: componentChild});
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
  const content = await node.exportAsync({format: 'SVG_STRING'})
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
      file_path: 'figma-variables/uds-variables.json',
    //file_path: 'demo/demo-variables.json',
      content: JSON.stringify(fileContent)
    }
    console.log(requestParams);

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
  
  for (const mode of modes) {
    
    const modeData = {
      name: mode.name,
      variables: []
    }
    for (const variableId of variableIds) {
      let variableData = {
      }

      let isAlias = false;

      const { name, resolvedType, valuesByMode } =
        await figma.variables.getVariableByIdAsync(variableId);

        // TODO to be checked


      const value: any = valuesByMode[mode.modeId];
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
